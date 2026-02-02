import { Command } from 'commander';

const BASH_COMPLETION_SCRIPT = `###-begin-linear-completions-###
#
# Bash completion script for linear-cli
#
_linear_completions()
{
    local cur prev words cword
    _init_completion || return

    local commands="auth issues issue i projects project p teams team t cycles cycle c labels label l users user u states state s completion help"
    local auth_commands="login logout status refresh setup-oauth"
    local issues_commands="list ls view show create update delete archive comment comments"
    local projects_commands="list ls view show create update"
    local teams_commands="list ls view show"
    local cycles_commands="list ls view show create current"
    local labels_commands="list ls create"
    local users_commands="list ls view show me"
    local states_commands="list ls"

    local global_opts="--json --no-color --help -h"

    # Determine context
    local cmd=""
    local subcmd=""
    local i

    for ((i=1; i < cword; i++)); do
        case "\${words[i]}" in
            auth|issues|issue|i|projects|project|p|teams|team|t|cycles|cycle|c|labels|label|l|users|user|u|states|state|s)
                cmd="\${words[i]}"
                ;;
            login|logout|status|refresh|setup-oauth|list|ls|view|show|create|update|delete|archive|comment|comments|current|me)
                if [[ -n "$cmd" ]]; then
                    subcmd="\${words[i]}"
                fi
                ;;
        esac
    done

    # Complete based on context
    case "$cmd" in
        "")
            COMPREPLY=($(compgen -W "$commands --version -V --help -h" -- "$cur"))
            return
            ;;
        auth)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$auth_commands" -- "$cur"))
            else
                case "$subcmd" in
                    login)
                        COMPREPLY=($(compgen -W "--oauth --key --client-id --client-secret --help -h" -- "$cur"))
                        ;;
                    status)
                        COMPREPLY=($(compgen -W "--json --help -h" -- "$cur"))
                        ;;
                    setup-oauth)
                        COMPREPLY=($(compgen -W "--client-id --client-secret --help -h" -- "$cur"))
                        ;;
                    *)
                        COMPREPLY=($(compgen -W "--help -h" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;
        issues|issue|i)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$issues_commands" -- "$cur"))
            else
                case "$subcmd" in
                    list|ls)
                        COMPREPLY=($(compgen -W "--team --state --assignee --project --limit $global_opts" -- "$cur"))
                        ;;
                    view|show)
                        COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
                        ;;
                    create)
                        COMPREPLY=($(compgen -W "--title --description --team --state --assignee --project --priority --labels --estimate $global_opts" -- "$cur"))
                        ;;
                    update)
                        COMPREPLY=($(compgen -W "--title --description --state --assignee --project --priority --labels --estimate $global_opts" -- "$cur"))
                        ;;
                    delete|archive)
                        COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
                        ;;
                    comment)
                        COMPREPLY=($(compgen -W "--body $global_opts" -- "$cur"))
                        ;;
                    comments)
                        COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;
        projects|project|p)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$projects_commands" -- "$cur"))
            else
                case "$subcmd" in
                    list|ls)
                        COMPREPLY=($(compgen -W "--team --limit $global_opts" -- "$cur"))
                        ;;
                    view|show)
                        COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
                        ;;
                    create)
                        COMPREPLY=($(compgen -W "--name --description --teams --lead --target-date $global_opts" -- "$cur"))
                        ;;
                    update)
                        COMPREPLY=($(compgen -W "--name --description --lead --target-date --state $global_opts" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;
        teams|team|t)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$teams_commands" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
            fi
            return
            ;;
        cycles|cycle|c)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$cycles_commands" -- "$cur"))
            else
                case "$subcmd" in
                    list|ls)
                        COMPREPLY=($(compgen -W "--team --limit $global_opts" -- "$cur"))
                        ;;
                    create)
                        COMPREPLY=($(compgen -W "--team --starts-at --ends-at --name --description $global_opts" -- "$cur"))
                        ;;
                    current)
                        COMPREPLY=($(compgen -W "--team $global_opts" -- "$cur"))
                        ;;
                    *)
                        COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;
        labels|label|l)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$labels_commands" -- "$cur"))
            else
                case "$subcmd" in
                    list|ls)
                        COMPREPLY=($(compgen -W "--team $global_opts" -- "$cur"))
                        ;;
                    create)
                        COMPREPLY=($(compgen -W "--name --team --color --description $global_opts" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;
        users|user|u)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$users_commands" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
            fi
            return
            ;;
        states|state|s)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=($(compgen -W "$states_commands" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "--team $global_opts" -- "$cur"))
            fi
            return
            ;;
    esac
}

complete -F _linear_completions linear
###-end-linear-completions-###`;

export function createCompletionCommand(): Command {
  const completion = new Command('completion')
    .description('Output shell completion script')
    .option('--shell <shell>', 'Shell type (bash)', 'bash')
    .action((options: { shell: string }) => {
      if (options.shell !== 'bash') {
        console.error(`Unsupported shell: ${options.shell}. Only bash is currently supported.`);
        process.exit(1);
      }
      console.log(BASH_COMPLETION_SCRIPT);
    });

  return completion;
}
