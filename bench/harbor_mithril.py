"""Optional Harbor 0.24 integration for the public Mithril Hermes fork.

No API credentials are installed here. OPENAI_BASE_URL must name an owning,
bounded relay to api.mithril.fund; the agent receives only a benchmark token.
This measures the general Hermes terminal loop, not the static-document core.
"""
import shlex
import yaml

from harbor.agents.installed.hermes import Hermes

MITHRIL_AGENT_REVISION = "e4a9b3d23d89429c2a59e97546c77685d37ade35"


class MithrilHermes(Hermes):
    @staticmethod
    def name():
        return "mithril-hermes-terminal"

    def get_version_command(self):
        return "git -C /opt/mithril-hermes rev-parse HEAD"

    @staticmethod
    def _build_config_yaml(model, max_turns=None):
        config = yaml.safe_load(Hermes._build_config_yaml(model, max_turns))
        config["model"] = {"default": model, "provider": "openai-api", "api_mode": "chat_completions"}
        config["display"] = {"streaming": False}
        return yaml.safe_dump(config)

    async def install(self, environment):
        await self.ensure_system_dependencies(environment, ("curl", "git", "ripgrep", "xz"))
        revision = shlex.quote(MITHRIL_AGENT_REVISION)
        await self.exec_as_agent(
            environment,
            command=(
                "set -euo pipefail; "
                "curl -LsSf https://astral.sh/uv/install.sh | sh; "
                'export PATH="$HOME/.local/bin:$PATH"; '
                "git init /opt/mithril-hermes; "
                "git -C /opt/mithril-hermes remote add origin "
                "https://github.com/mithril-lang/mithril-agent.git; "
                f"git -C /opt/mithril-hermes fetch --depth 1 origin {revision}; "
                "git -C /opt/mithril-hermes checkout --detach FETCH_HEAD; "
                "uv venv --python 3.14 /opt/mithril-hermes/.venv; "
                "uv pip install --python /opt/mithril-hermes/.venv/bin/python "
                "-e /opt/mithril-hermes; "
                'mkdir -p "$HOME/.local/bin" /tmp/hermes/sessions /tmp/hermes/skills /tmp/hermes/memories; '
                'ln -s /opt/mithril-hermes/.venv/bin/hermes "$HOME/.local/bin/hermes"; '
                "git -C /opt/mithril-hermes rev-parse HEAD"
            ),
        )
