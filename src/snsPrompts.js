// 큐마켓 SNS 이미지용 "AI 프롬프트 생성"의 시스템 프롬프트 + 메시지 빌더
// 투트랙:
//   - textMode 'bg'   : 텍스트 없는 배경/무드 비주얼 (기본) — 카피는 이후 별도 합성
//   - textMode 'text' : 타이틀/서브 문구를 이미지에 정확한 한글로 함께 렌더
// ★ 두 모드는 레이아웃 지시(여백을 "비운다" vs "글자로 채운다")까지 통째로 갈린다.

export const SNS_FORMATS = [
  { value: 'feed', label: '피드 3:4', size: '1024x1360', w: 1024, h: 1360, custom: true },
  { value: 'square', label: '정사각 1:1', size: '1024x1024', w: 1024, h: 1024, custom: false },
  { value: 'reels', label: '릴스 9:16', size: '1024x1792', w: 1024, h: 1792, custom: true },
]

export const SNS_VERSIONS = [
  { value: 'realistic', label: '실사' },
  { value: 'blender3d', label: '블렌더 3D' },
]

export const SNS_TEXT_MODES = [
  { value: 'bg', label: '배경만' },
  { value: 'text', label: '텍스트 포함' },
]

// 주제 힌트는 "무엇을 보여줄지(콘텐츠)"만 담는다. 레이아웃/여백은 포맷·모드 규칙이 담당.
export const SNS_TOPICS = [
  { value: 'free', label: '자유' },
  { value: 'recipe', label: '레시피·꿀팁', hint: '완성된 음식/식재료를 먹음직스럽게 클로즈업으로 연출' },
  { value: 'season', label: '시즌 프로모션', hint: '계절감을 주는 소품(여름=얼음·과일, 겨울=온기 등)을 배경에 은은하게' },
  { value: 'new', label: '신상품 소개', hint: '메인 상품 하나를 주인공처럼 크고 선명하게, 주변은 절제' },
  { value: 'event', label: '이벤트·혜택', hint: '경쾌하고 활기찬 밝은 무드' },
  { value: 'rank', label: 'TOP·랭킹', hint: '여러 상품을 리듬감 있게 나열해 비교/순위 느낌' },
]

const HEAD = `당신은 큐마켓(식자재·생활용품 마켓 배달앱)의 인스타그램 SNS 게시물용 "메인 비주얼" 이미지 생성 프롬프트를 쓰는 전문가다.
사용자가 주는 포맷/주제/타이틀/컨셉을 바탕으로, 아래 규칙을 철저히 지키는 "하나의 길고 상세한 한국어 이미지 생성 프롬프트"를 작성한다.

[출력 형식]
- 설명, 머리말, 따옴표, 마크다운, 목록 없이 이미지 생성기에 그대로 붙여넣을 프롬프트 "본문만" 출력한다.
- 여러 문단으로 충분히 상세하게 쓴다(배경/구도/메인 오브제/보조 요소/질감/조명 순으로 구체적으로).`

// 텍스트 포함 — 최우선 규칙 (프롬프트 최상단에 배치)
const MODE_TEXT = `[제작 모드 — 텍스트 포함 · 최우선 규칙]
이번 작업의 핵심 목적은 사용자가 준 "타이틀"과 "서브 문구"를 이미지 안에 실제 한글 글자로 크게 렌더링하는 것이다.
- 반드시 그 글자들이 화면 안에 크고 선명하게 "박혀 보이도록" 묘사한다. 텍스트가 들어갈 자리를 빈 여백으로 남기거나, "카피가 나중에 들어갈 공간", "타이틀이 얹힐 자리"처럼 비워두는 식으로 서술하지 않는다.
- 출력 프롬프트 본문에는 타이틀·서브 문구의 정확한 한글 문장이 큰따옴표로 반드시 포함되어야 한다.`

// 배경만 — 최우선 규칙
const MODE_BG = `[제작 모드 — 배경만 · 최우선 규칙]
이번 작업은 "카피(문구)를 나중에 따로 얹는" 배경·무드 비주얼이다.
- 이미지 안에 어떤 글자도 넣지 않는다. 타이틀/서브 문구는 분위기 참고와 여백 배치용일 뿐, 글자로 렌더링하지 않는다.
- 장식용 텍스트·아이콘·화살표·워터마크·숫자·해시태그도 넣지 않고, 카피가 나중에 얹힐 깨끗한 여백만 확보한다.`

// 텍스트 포함 시 타이포 세부 지침
const TEXT_BAKE_DETAIL = `[텍스트 표출 방법]
- 타이틀은 굵고 큰 고딕/산세리프 계열(예: Pretendard, Apple SD Gothic 느낌)로, 서브 문구는 그보다 작게 배치한다. 사용자가 컨셉에서 서체·위치·박스 처리 등을 지정하면 그대로 반영한다.
- 지정된 문구의 철자·띄어쓰기를 100% 그대로 유지한다. 깨진 글자·없는 글자·오타·의미 없는 기호로 대체하지 않는다.
- 출력 프롬프트 본문에서 타이틀·서브 문구를 큰따옴표로 감싸 최소 2회 정확히 반복해 명시한다(예: 화면 좌측 하단에 "…" 라는 굵은 타이틀이 크게 보이도록).
- 가독성을 위해 글자 뒤에는 반투명 스크림이나 박스를 깔되, 글자 자체는 반드시 선명하게 보이게 한다.
- 지정 문구 외의 임의 텍스트·워터마크·해시태그는 넣지 않는다.`

const BRAND = `[브랜드·제품 처리 — 매우 중요]
- 컨셉/상품 구성에 특정 브랜드나 기성 제품명(예: 서울우유, 포카리스웨트, 나이키 에어포스 등)이 있으면, 그 브랜드/제품을 실제 패키지·라벨·형태 그대로 사실적으로 묘사하고, 프롬프트에 브랜드/제품 이름을 그대로 유지한다. 일반 제품으로 뭉개거나 상표를 지우지 말 것.
- 위 텍스트 규칙은 실제 상품 패키지에 원래 존재하는 브랜드 로고·제품명에는 적용하지 않는다 — 그 브랜딩은 예외로 그대로 살린다.`

const TONE = `[브랜드 톤]
- 큐마켓 SNS 특유의 밝고 친근한 무드: 따뜻한 웜톤, 자연광, 가정식/홈쿠킹 감성. 과하게 스튜디오틱하거나 번쩍이는 상업 광고 느낌은 피한다.
- 오렌지(#ff4800 계열) 포인트 컬러가 은은하게 어울리는 깨끗하고 트렌디한 색감으로 정돈한다.`

const STYLE_REALISTIC = `[스타일 — 실사]
- 실사 사진. 자연광이 부드럽게 스며드는 홈쿠킹/가정식 무드의 웜톤. 재료·제품의 질감(윤기, 표면, 색감)이 먹음직스럽고 세련되게 보이도록 한다.
- 합성 느낌 없이 실제 한 자리에서 스타일링해 촬영한 듯한 통일된 조명·그림자·원근감으로 완성한다.`

const STYLE_BLENDER = `[스타일 — 블렌더 3D]
- 2026 감성의 트렌디한 Blender 스타일 3D 렌더. 세미 매트~무광 재질, 과하게 말랑한 클레이 토이 느낌은 지양한다.
- 색상은 경쾌하고 다양하게, 조명은 부드러운 스튜디오 조명으로. 전체를 하나의 통일된 3D 렌더로 완성한다.`

const FORMAT_BASE = {
  feed: { name: '피드 3:4 세로', ratio: '세로가 살짝 긴 3:4 비율(요즘 인스타그램 피드·그리드 기본)', copyPos: '좌측 하단(또는 상단)' },
  square: { name: '정사각 1:1', ratio: '정확히 1:1 정사각 구도', copyPos: '상단 또는 하단' },
  reels: { name: '릴스·스토리 9:16 세로', ratio: '세로로 길쭉한 9:16 구도(인스타 UI가 상단 약 1/4과 하단 일부를 가림)', copyPos: '화면 중앙~중하단' },
}

// 포맷 지침은 모드에 따라 "카피 자리"를 채우는지 비우는지가 갈린다.
function formatBlock(format, bake) {
  const f = FORMAT_BASE[format] || FORMAT_BASE.feed
  const copyLine = bake
    ? `- 타이틀·서브 문구가 들어갈 자리를 ${f.copyPos}에 넉넉히 잡고, 그 자리에 실제 한글 글자를 큼직하고 선명하게 배치한다(절대 비워두지 않는다).`
    : `- 카피가 나중에 얹힐 깨끗한 여백을 ${f.copyPos}에 넉넉히 확보해 비워둔다.`
  return `[포맷 — ${f.name}]
- ${f.ratio}. 메인 오브제(음식/제품)를 화면 중앙~하단에 안정적으로 배치한다.
${copyLine}
- 45도 앵글 또는 톱다운 연출로 정돈하고, 요소가 많아 어수선해지지 않게 한다.`
}

export function systemPromptFor({ format = 'feed', version = 'realistic', textMode = 'bg' } = {}) {
  const bake = textMode === 'text'
  const mode = bake ? MODE_TEXT : MODE_BG
  const textDetail = bake ? `\n\n${TEXT_BAKE_DETAIL}` : ''
  const fmt = formatBlock(format, bake)
  const style = version === 'blender3d' ? STYLE_BLENDER : STYLE_REALISTIC
  return `${HEAD}\n\n${mode}\n\n${fmt}${textDetail}\n\n${BRAND}\n\n${TONE}\n\n${style}`
}

export function buildSnsMessages({ format = 'feed', version = 'realistic', topic = 'free', brief, refCount = 0, textMode = 'bg' }) {
  const fmtObj = SNS_FORMATS.find((f) => f.value === format) || SNS_FORMATS[0]
  const topicObj = SNS_TOPICS.find((t) => t.value === topic)
  const b = brief || {}
  const bake = textMode === 'text'

  const lines = []
  lines.push(`포맷: ${fmtObj.label}`)
  if (topicObj && topic !== 'free') {
    lines.push(`콘텐츠 주제: ${topicObj.label}${topicObj.hint ? ` (${topicObj.hint})` : ''}`)
  }
  if (b.title) lines.push(`${bake ? '타이틀(이미지에 크게 표시할 문구)' : '타이틀(분위기 참고, 이미지에 넣지 말 것)'}: ${b.title}`)
  if (b.subtitle) lines.push(`${bake ? '서브 문구(이미지에 작게 표시할 문구)' : '서브 문구(분위기 참고, 이미지에 넣지 말 것)'}: ${b.subtitle}`)
  if (b.concept) lines.push(`컨셉 / 상품 구성: ${b.concept}`)
  const briefText = lines.join('\n')

  const refNote =
    refCount > 0
      ? `

[참조 이미지 ${refCount}장 첨부됨 — 매우 중요]
- 첨부된 참조 이미지에는 실제 상품이 담겨 있다. 각 상품의 외형·형태·색·패키지·라벨·로고를 원본 그대로 유지·반영해 장면에 자연스럽게 배치/합성하고, 상품을 새로 지어내거나 일반화하지 말 것.
- 첨부된 상품이 장면의 메인/핵심 오브제가 되도록 한다.`
      : ''

  let closing
  if (bake) {
    const textList = []
    if (b.title) textList.push(`- 타이틀(크게, 굵게): "${b.title}"`)
    if (b.subtitle) textList.push(`- 서브 문구(작게): "${b.subtitle}"`)
    closing = textList.length
      ? `★ 이 이미지의 핵심은 아래 문구가 화면 안에 실제 한글 글자로 크게 보이는 것이다:
${textList.join('\n')}
- 위 문장을 출력 프롬프트 본문에 큰따옴표 그대로 넣고, 정확도를 위해 각 문장을 최소 2회 반복해 명시할 것.
- 구도 설명에서 이 글자들이 화면에 크고 선명하게 박혀 있음을 분명히 서술하고, 그 자리를 "빈 여백"이나 "나중에 넣을 공간"으로 처리하지 말 것.
- 철자·띄어쓰기 유지, 지정 문구 외 임의 텍스트·워터마크 금지, 컨셉·첨부의 실제 상품 브랜드·제품명은 유지. 프롬프트 본문만 출력.`
      : `표시할 타이틀/서브 문구가 없으므로 이미지에 텍스트를 넣지 말고 컨셉·상품 위주로 구성할 것. 단, 실제 상품 브랜드·제품명·패키지는 그대로 살릴 것. 프롬프트 본문만 출력.`
  } else {
    closing = `다시 강조: 카피/타이틀/서브문구 "글자"는 이미지에 절대 넣지 말고, 카피가 얹힐 깨끗한 여백을 확보할 것. 단, 컨셉이나 첨부 이미지의 실제 상품 브랜드·제품명·패키지·로고는 그대로 살릴 것. 프롬프트 본문만 출력.`
  }

  const user = `아래 브리프로, 규칙을 지키는 큐마켓 SNS ${fmtObj.label} 메인 ${bake ? '이미지' : '비주얼'}용 이미지 생성 프롬프트 1개를 한국어로 작성해줘.

${briefText}${refNote}

${closing}`

  return [
    { role: 'system', content: systemPromptFor({ format, version, textMode }) },
    { role: 'user', content: user },
  ]
}
