import { codeToHtml } from "shiki";

type Props = {
  code: string;
  lang?: string;
  caption?: string;
  fileName?: string;
};

export async function Code({ code, lang = "typescript", caption, fileName }: Props) {
  const html = await codeToHtml(code, {
    lang,
    theme: "vesper",
  });

  return (
    <figure className="overflow-hidden rounded-xl border border-ink-800/80 bg-ink-950/80 backdrop-blur ring-1 ring-inset ring-white/[0.03] shadow-2xl shadow-emerald-950/20">
      {(fileName || caption) && (
        <div className="flex items-center justify-between border-b border-ink-800/70 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
            </div>
            {fileName && <span className="ml-3 text-ink-400 normal-case tracking-normal font-mono text-xs">{fileName}</span>}
          </div>
          {caption && <span className="text-ink-600">{caption}</span>}
        </div>
      )}
      <div
        className="text-[13px] [&_pre]:!bg-transparent [&_pre]:py-5 [&_pre]:px-5 [&_pre]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
