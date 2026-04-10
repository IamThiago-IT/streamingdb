export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center justify-center gap-8 py-32 px-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          Oi! 👋
        </h1>
        <div className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          <p className="mb-4">
            Bem-vindo ao <strong>StreamingDB</strong>!
          </p>
          <p>
            O objetivo deste projeto é criar um site/app semelhante ao SteamDB, 
            com informações sobre jogos,streaming e dados relacionados.
          </p>
        </div>
      </main>
    </div>
  );
}