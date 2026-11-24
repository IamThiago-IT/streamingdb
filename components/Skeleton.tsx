/**
 * Bloco de carregamento (skeleton) com o ritmo visual do layout real,
 * para evitar *layout shift* e dar feedback imediato enquanto o server
 * component busca dados. A forma (tamanhos/raio) é aplicada via className.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`animate-pulse bg-surface-2 ${className}`} />
  );
}
