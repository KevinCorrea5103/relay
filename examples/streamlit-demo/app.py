"""Streamlit chat UI for the Relay Python SDK.

Run:
    cp .env.example .env  # fill RELAY_API_KEY
    pip install -e .
    streamlit run app.py
"""

from __future__ import annotations

import os
from pathlib import Path

import streamlit as st

# Load .env if present (so RELAY_API_KEY works without exporting)
_env = Path(__file__).parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

from agents import PRESETS, Preset, build_agent  # noqa: E402
from bridge import async_to_sync_iter  # noqa: E402

st.set_page_config(
    page_title="Relay demo",
    page_icon="●",
    layout="centered",
)


# ─── Sidebar: preset picker + key check ────────────────────────────────────

with st.sidebar:
    st.markdown("### Relay demo")
    st.caption("Streamlit + @relayhq/sdk (Python) · multiple tools")

    if not os.environ.get("RELAY_API_KEY"):
        st.error(
            "RELAY_API_KEY missing.\n\n"
            "Get a free one at https://relaygh.dev/en/signup and put it in .env"
        )
        st.stop()

    preset_name = st.selectbox(
        "Agent preset",
        options=list(PRESETS.keys()),
        index=0,
    )
    preset: Preset = PRESETS[preset_name]
    st.caption(preset.description)

    with st.expander("System prompt", expanded=False):
        st.markdown(
            f"<div style='font-size:0.85rem;line-height:1.5;color:#cbd5e1;"
            f"white-space:pre-wrap;word-wrap:break-word;'>{preset.system}</div>",
            unsafe_allow_html=True,
        )

    with st.expander("Tools wired", expanded=False):
        for t in preset.tools:
            name = t.get("name", "?")  # type: ignore[union-attr]
            kind = t.get("kind", "?")  # type: ignore[union-attr]
            st.markdown(f"- `{name}` · _{kind}_")

    model = os.environ.get("RELAY_MODEL", "gpt-4o-mini")
    st.caption(f"Model: `{model}` · Cloud: `{os.environ.get('RELAY_URL', 'api.relaygh.dev')}`")

    if st.button("Clear conversation", use_container_width=True):
        st.session_state.messages = []
        st.rerun()


# ─── Reset history when the preset changes ─────────────────────────────────

if "preset_name" not in st.session_state:
    st.session_state.preset_name = preset_name
if st.session_state.preset_name != preset_name:
    st.session_state.preset_name = preset_name
    st.session_state.messages = []


# ─── Chat history ──────────────────────────────────────────────────────────

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ─── Chat input + streaming ────────────────────────────────────────────────

prompt = st.chat_input(f"Ask the {preset_name.lower()}…")

if prompt:
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    agent = build_agent(preset)

    with st.chat_message("assistant"):
        # We can't use st.write_stream directly because we want richer rendering
        # for tool_call / tool_result events. Build a placeholder and append.
        placeholder = st.empty()
        rendered = ""

        def stream_events():
            return agent.run(prompt)

        try:
            for event in async_to_sync_iter(stream_events):
                t = event["type"]
                if t == "token":
                    rendered += event["text"]
                elif t == "tool_call":
                    name = event.get("name", "?")
                    args = event.get("input", {})
                    rendered += f"\n\n`→ {name}({args})`\n"
                elif t == "tool_result":
                    out = event.get("output")
                    # Trim if huge
                    pretty = str(out)
                    if len(pretty) > 600:
                        pretty = pretty[:600] + "…"
                    rendered += f"`  ↪ {pretty}`\n\n"
                elif t == "done":
                    usage = event.get("usage", {})
                    if usage:
                        rendered += (
                            f"\n\n<sub>tokens in: {usage.get('input_tokens', '?')} · "
                            f"out: {usage.get('output_tokens', '?')}</sub>"
                        )
                elif t == "error":
                    rendered += f"\n\n**Error:** {event.get('message')}"

                placeholder.markdown(rendered, unsafe_allow_html=True)
        except Exception as err:  # noqa: BLE001
            rendered += f"\n\n**Connection error:** {err}"
            placeholder.markdown(rendered)

    st.session_state.messages.append({"role": "assistant", "content": rendered})
