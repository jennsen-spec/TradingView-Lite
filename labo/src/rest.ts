// Accès PostgREST (lecture seule, clé publishable) + petits utilitaires réseau.

async function attendre(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getJson(url: string, cle: string): Promise<unknown> {
  let derniereErreur: unknown;
  for (let essai = 0; essai < 4; essai++) {
    try {
      const rep = await fetch(url, {
        headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      });
      if (rep.status === 429 || rep.status >= 500) {
        derniereErreur = new Error(`HTTP ${rep.status} sur ${url}`);
        await attendre(500 * (essai + 1) ** 2);
        continue;
      }
      if (!rep.ok) throw new Error(`HTTP ${rep.status} sur ${url}: ${await rep.text()}`);
      return await rep.json();
    } catch (e) {
      derniereErreur = e;
      await attendre(500 * (essai + 1) ** 2);
    }
  }
  throw derniereErreur;
}

export async function postRpc(base: string, cle: string, fn: string, corps: unknown): Promise<unknown> {
  const rep = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: cle,
      Authorization: `Bearer ${cle}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corps),
  });
  if (!rep.ok) throw new Error(`RPC ${fn}: HTTP ${rep.status}: ${await rep.text()}`);
  return await rep.json();
}

// Pagination keyset sur une colonne strictement croissante (bar_date) pour un filtre donné.
export async function paginerParDate(
  base: string,
  cle: string,
  table: string,
  filtres: string, // ex. "instrument_id=eq.4" (déjà encodé)
  select: string,
  colonneDate = "bar_date",
): Promise<Record<string, unknown>[]> {
  const lignes: Record<string, unknown>[] = [];
  let curseur: string | null = null;
  for (;;) {
    const borne = curseur ? `&${colonneDate}=gt.${curseur}` : "";
    const url = `${base}/rest/v1/${table}?select=${select}&${filtres}${borne}&order=${colonneDate}.asc&limit=1000`;
    const page = (await getJson(url, cle)) as Record<string, unknown>[];
    lignes.push(...page);
    if (page.length < 1000) return lignes;
    curseur = String(page[page.length - 1][colonneDate]);
  }
}

export async function enParallele<T, R>(
  elements: T[],
  concurrence: number,
  fn: (t: T, i: number) => Promise<R>,
): Promise<R[]> {
  const resultats: R[] = new Array(elements.length);
  let prochain = 0;
  async function ouvrier(): Promise<void> {
    for (;;) {
      const i = prochain++;
      if (i >= elements.length) return;
      resultats[i] = await fn(elements[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrence, elements.length) }, ouvrier));
  return resultats;
}
