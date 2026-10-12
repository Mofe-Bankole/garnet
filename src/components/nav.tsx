import Link from "next/link";
import { Wordmark } from "./brand";

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/";

export function Nav({ current }: { current?: "home" | "demo" }) {
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-graphite/85 backdrop-blur">
      <nav className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3.5" aria-label="Main">
        <Link href="/" aria-label="Garnet home" className="shrink-0">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-7 text-sm text-ivory/65 md:flex">
          <li>
            <Link href="/#product" className="inline-block py-2 hover:text-ivory">
              Product
            </Link>
          </li>
          <li>
            <Link href="/#how" className="inline-block py-2 hover:text-ivory">
              How it works
            </Link>
          </li>
          <li>
            <a href={REPO_URL} className="inline-block py-2 hover:text-ivory" rel="noreferrer" target="_blank">
              GitHub
            </a>
          </li>
        </ul>
        {current === "demo" ? (
          <Link href="/" className="rounded-full border hairline px-4 py-1.5 text-sm text-ivory/80 hover:border-rose/50 hover:text-ivory">
            About Garnet
          </Link>
        ) : (
          <Link href="/demo" className="rounded-full bg-ivory px-4 py-1.5 text-sm font-medium text-graphite transition hover:bg-rose">
            Launch Demo
          </Link>
        )}
      </nav>
    </header>
  );
}
