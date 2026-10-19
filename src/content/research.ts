export const scientificNotes = [
  {
    title: "見つからないことは、不在の証明ではない。",
    text: "観測記録にない関係でも、見逃されている可能性があります。記録上のゼロと、実際に関係が存在しないことは区別します。",
  },
  {
    title: "元データにも、観測の限界がある。",
    text: "公開データの全記録を使っても、生態系全体を完全に記録したことにはなりません。比較の基準は「元の観測記録」です。",
  },
  {
    title: "花を訪れた記録から、言える範囲を守る。",
    text: "訪花は昆虫が花を訪れた記録です。その記録だけで、有効な送粉や植物の繁殖への寄与を断定しません。",
  },
  {
    title: "モデルの条件を、現実の変化と混同しない。",
    text: "記録の抽出による変化は、生物の減少や絶滅を再現したものではありません。結果はデータと仮定の範囲内で解釈します。",
  },
] as const;

export const references = [
  {
    id: "00",
    kind: "採用データ · 英国の実験 · 大学保管v1",
    title: "Climate change impacts on plant-pollinator interactions and functioning - experiment data",
    detail: "Ellen Moss / Darren Evans (2022)。原CSVの全3,882訪花記録を保持し、原分類ラベルのまま正規化・非復元抽出・ネットワーク集計・反復統計・比較描画に使用します。CC BY 4.0。元の著者による承認・推奨を意味しません。",
    url: "https://doi.org/10.25405/data.ncl.17430548.v1",
  },
  {
    id: "01",
    kind: "データベース候補 · 未採用",
    title: "Web of Life",
    detail:
      "生物間相互作用ネットワークの公開データベース。背景の調査先であり、現在の計算には採用していません。",
    url: "https://www.web-of-life.es/",
  },
  {
    id: "02",
    kind: "研究論文 · 観測の完全性",
    title:
      "Evaluating sampling completeness in a desert plant–pollinator network",
    detail:
      "Chacoff et al. (2012), Journal of Animal Ecology, 81:190–200. DOI: 10.1111/j.1365-2656.2011.01883.x。観測の完全性を検討した研究で、結果の他地域への一般化は行いません。",
    url: "https://doi.org/10.1111/j.1365-2656.2011.01883.x",
  },
  {
    id: "03",
    kind: "データベースの説明資料",
    title: "The Web of Life",
    detail:
      "Fortuna, Ortega & Bascompte (2014), arXiv:1403.2575。データベースの構造と公開方法を説明する資料です。データ自体の利用許諾を代替しません。",
    url: "https://arxiv.org/abs/1403.2575",
  },
] as const;
