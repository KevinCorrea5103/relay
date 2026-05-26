import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P, Table, Td, Th } from "@/components/DocsPage";

export default async function VoiceDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="voice"
      lang={lang}
      title="Voice"
      description="Speech-to-text and text-to-speech endpoints, BYOK against OpenAI. Audio bytes pass through — they never touch our database."
    >
      <section>
        <H2 id="overview">What ships today</H2>
        <P>
          Pattern A — pre/post processing. Two endpoints:
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Endpoint</Th>
              <Th>Direction</Th>
              <Th>Provider</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td mono>POST /v1/transcribe</Td>
              <Td>audio → text</Td>
              <Td>OpenAI Whisper (whisper-1)</Td>
            </tr>
            <tr>
              <Td mono>POST /v1/synthesize</Td>
              <Td>text → audio</Td>
              <Td>OpenAI TTS (tts-1, tts-1-hd, gpt-4o-mini-tts)</Td>
            </tr>
          </tbody>
        </Table>
        <Callout kind="note">
          Both endpoints use the tenant&apos;s existing{" "}
          <InlineCode>openai</InlineCode> BYOK credential. Audio bytes pass
          through Relay to OpenAI and back — nothing is persisted on our
          side beyond a single audit log row per call.
        </Callout>
      </section>

      <section>
        <H2 id="transcribe">Transcribe (STT)</H2>
        <P>
          Multipart upload. The <InlineCode>file</InlineCode> field is the
          audio binary; supported formats are whatever Whisper accepts
          (mp3, mp4, mpeg, mpga, m4a, wav, webm).
        </P>
        <Code
          lang="bash"
          code={`curl -X POST https://api.relaygh.dev/v1/transcribe \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -F file=@clip.mp3 \\
  -F language=es

# → { "text": "Hola, esto es una prueba." }`}
        />

        <H3 id="transcribe-ts">TypeScript</H3>
        <Code
          lang="ts"
          code={`import { transcribe } from "@relayhq/sdk";

const file = await fetch("./clip.mp3").then((r) => r.blob());
const { text } = await transcribe({
  file,
  language: "es",
  responseFormat: "json", // or "text" | "srt" | "vtt" | "verbose_json"
});
console.log(text);`}
        />

        <H3 id="transcribe-py">Python</H3>
        <Code
          lang="python"
          code={`from pathlib import Path
from relayhq import transcribe

result = await transcribe(
    file=Path("clip.mp3"),
    language="es",
)
print(result["text"])`}
        />
      </section>

      <section>
        <H2 id="synthesize">Synthesize (TTS)</H2>
        <P>
          JSON in, audio bytes out. The response streams the audio in the
          requested format; the SDK helpers buffer it into an{" "}
          <InlineCode>ArrayBuffer</InlineCode> (TS) or{" "}
          <InlineCode>bytes</InlineCode> (Python).
        </P>
        <Code
          lang="bash"
          code={`curl -X POST https://api.relaygh.dev/v1/synthesize \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "Hola, esto es una prueba.",
    "model": "tts-1",
    "voice": "nova",
    "format": "mp3"
  }' \\
  --output hello.mp3`}
        />

        <H3 id="synthesize-ts">TypeScript</H3>
        <Code
          lang="ts"
          code={`import { synthesize } from "@relayhq/sdk";

const { audio, mime } = await synthesize({
  input: "Hello from Relay",
  voice: "alloy",
  format: "mp3",
});

// Browser: play it
const blob = new Blob([audio], { type: mime });
const url = URL.createObjectURL(blob);
new Audio(url).play();`}
        />

        <H3 id="synthesize-py">Python</H3>
        <Code
          lang="python"
          code={`from pathlib import Path
from relayhq import synthesize

audio_bytes, mime = await synthesize(
    input="Hola desde Relay",
    voice="nova",
    format="mp3",
)
Path("hello.mp3").write_bytes(audio_bytes)`}
        />

        <H3 id="synthesize-options">Options</H3>
        <Table>
          <thead>
            <tr>
              <Th>Field</Th>
              <Th>Allowed</Th>
              <Th>Default</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td mono>model</Td>
              <Td>tts-1 · tts-1-hd · gpt-4o-mini-tts</Td>
              <Td mono>tts-1</Td>
            </tr>
            <tr>
              <Td mono>voice</Td>
              <Td>alloy · ash · ballad · coral · echo · fable · onyx · nova · sage · shimmer · verse</Td>
              <Td mono>alloy</Td>
            </tr>
            <tr>
              <Td mono>format</Td>
              <Td>mp3 · opus · aac · flac · wav · pcm</Td>
              <Td mono>mp3</Td>
            </tr>
            <tr>
              <Td mono>input</Td>
              <Td>≤ 4096 characters</Td>
              <Td>—</Td>
            </tr>
          </tbody>
        </Table>
      </section>

      <section>
        <H2 id="setup">Setup</H2>
        <P>
          The only requirement is an{" "}
          <InlineCode>openai</InlineCode> credential on your tenant. If
          you&apos;ve used Relay with GPT-4o, you already have it.
          Otherwise:
        </P>
        <Code
          lang="bash"
          code={`curl -X PUT https://api.relaygh.dev/v1/credentials/openai \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"apiKey":"sk-..."}'`}
        />
      </section>

    </DocsPage>
  );
}
