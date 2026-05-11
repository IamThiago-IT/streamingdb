import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "./dictionaries";
import ThemeToggle from "./ThemeToggle";

export default async function Home({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <ThemeToggle />
      <main className="flex flex-col items-center justify-center gap-8 py-32 px-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          {dict.home.greeting}
        </h1>
        <div className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          <p
            className="mb-4"
            dangerouslySetInnerHTML={{ __html: dict.home.welcome }}
          />
          <p>{dict.home.description}</p>
        </div>
      </main>
    </div>
  );
}
