/* ================================================================
   職種別ページ — 唯一の情報源
   第1弾では全件draft(ページ非生成・導線なし)。第2弾で執筆・公開する。
   各ページには運営者の関与の立場(当事者/経営支援での伴走)を
   正直に書く(PM条件 2026-07-18、第12条)。
   ================================================================ */

export const PROFESSION_PAGES = [
  { id: 'reha', slug: 'rehabilitation', title: 'リハビリ職の管理職', standpoint: 'insider', status: 'draft' },
  { id: 'nurse', slug: 'nurse', title: '看護管理職', standpoint: 'support', status: 'draft' },
  { id: 'homon', slug: 'homecare-nurse', title: '訪問看護管理者', standpoint: 'support', status: 'draft' },
  { id: 'jimu', slug: 'medical-clerk', title: '医療事務責任者', standpoint: 'support', status: 'draft' },
];

export const publishedProfessions = () => PROFESSION_PAGES.filter((p) => p.status === 'published');
