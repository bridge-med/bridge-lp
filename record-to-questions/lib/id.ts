let counter = 0;

/** 端末内で衝突しない程度の ID(サーバー DB に移すときは DB 側の ID に置き換える) */
export function newId(prefix = "q"): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
