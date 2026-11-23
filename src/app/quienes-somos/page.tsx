import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { createDbClient, isValidD1Binding } from "@/db";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { getPublicSitePage } from "@/lib/public-pages";

export default async function AboutUsPage() {
  let db = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as Partial<CloudflareEnv>;
    if (isValidD1Binding(cfEnv.DB)) {
      db = createDbClient(cfEnv.DB);
    }
  } catch {
    // Uses seed fallback if called outside Cloudflare Worker context
  }

  const page = await getPublicSitePage(db, "quienes-somos");

  return (
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar currentPath="/quienes-somos" />

      <main id="contenido" className="container flex-1 py-16 sm:py-24">
        <article className="max-w-3xl border-t border-rule pt-10">
          <h1>
            {page.title === "¿Quiénes somos?" ? (
              <>
                ¿Quiénes <span className="ta-serif-italic">somos</span>?
              </>
            ) : (
              page.title
            )}
          </h1>
          <div
            className="riso-prose mt-10"
            dangerouslySetInnerHTML={{ __html: page.contentHtml }}
          />
        </article>
      </main>

      <Footer />
    </div>
  );
}
