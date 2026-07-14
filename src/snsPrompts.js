// 큐마켓 SNS 이미지용 "AI 프롬프트 생성"의 시스템 프롬프트 + 메시지 빌더
// 선택된 방향: "텍스트 없는 배경/무드 비주얼" — 카피는 이후 별도 툴에서 얹는다.
// (상세페이지 툴과 동일 아키텍처: 짧은 입력 → gpt-5.5가 상세 프롬프트로 확장)

export const SNS_FORMATS = [
  { value: 'feed', label: '피드 (1:1)', size: '1024x1024', w: 1024, h: 1024, custom: false },
  { value: 'reels', label: '릴스·스토리 (9:16)', size: '1024x1792', w: 1024, h: 1792, custom: true },
]

export const SNS_VERSIONS = [
  { value: 'realistic', label: '실사' },
  { value: 'blender3d', label: '블렌더 3D' },
]

export const SNS_TOPICS = [
  { value: 'free', label: '자유' },
  { value: 'recipe', label: '레시피·꿀팁', hint: '완성된 음식/식재료를 먹음직스럽게 연출, 정보 카드가 얹힐 여백 확보' },
  { value: 'season', label: '시즌 프로모션', hint: '계절감을 주는 소품(여름=얼음·과일, 겨울=온기 등)을 배경에 은은하게' },
  { value: 'new', label: '신상품 소개', hint: '메인 상품 하나를 주인공처럼 크고 선명하게, 주변은 절제' },
  { value: 'event', label: '이벤트·혜택', hint: '경쾌하고 활기찬 무드, 혜택 배지/문구가 얹힐 여백 확보' },
  { value: 'rank', label: 'TOP·랭킹', hint: '여러 상품을 리듬감 있게 나열하되 순위 텍스트가 얹힐 여백 확보' },
]

const COMMON = `당신은 큐마켓(식자재·생활용품 마켓 배달앱)의 인스타그램 SNS 게시물용 "메인 비주얼" 이미지 생성 프롬프트를 쓰는 전문가다.
사용자가 주는 포맷/주제/타이틀/컨셉을 바탕으로, 아래 규칙을 철저히 지키는 "하나의 길고 상세한 한국어 이미지 생성 프롬프트"를 작성한다.

[출력 형식]
- 설명, 머리말, 따옴표, 마크다운, 목록 없이 이미지 생성기에 그대로 붙여넣을 프롬프트 "본문만" 출력한다.
- 여러 문단으로 충분히 상세하게 쓴다(배경/구도/메인 오브제/보조 요소/질감/조명/여백 순으로 구체적으로).

[텍스트 처리 — 매우 중요]
- 이 이미지는 "카피(타이틀/문구)를 나중에 따로 얹는" 배경·무드 비주얼이다. 어떤 글자도 이미지 안에 넣지 않는다.
- 타이틀/서브문구는 분위기 참고 및 여백 배치 힌트로만 쓰고, 그 문구 자체를 이미지에 렌더링하지 않는다.
- 장식용 텍스트·아이콘·화살표·워터마크·숫자·해시태그도 넣지 않는다.
- 대신 카피가 얹힐 "깨끗하고 넓은 여백 구역"을 의도적으로 확보한다(아래 포맷 지침의 여백 위치를 따른다).

[브랜드·제품 처리 — 매우 중요]
- 컨셉/상품 구성에 특정 브랜드나 기성 제품명(예: 서울우유, 포카리스웨트, 나이키 에어포스, 아디다스 가젤 등)이 있으면, 그 브랜드/제품을 실제 패키지·라벨·형태 그대로 사실적으로 묘사하고, 프롬프트에 브랜드/제품 이름을 그대로 유지한다. 일반 제품으로 뭉개거나 상표를 지우지 말 것.
- 위의 "텍스트·로고 금지"는 카피와 장식 요소에만 적용되며, 실제 상품 패키지에 원래 존재하는 브랜드 로고·제품명은 예외로 그대로 살린다.

[브랜드 톤]
- 큐마켓 SNS 특유의 밝고 친근한 무드: 따뜻한 웜톤, 자연광, 가정식/홈쿠킹 감성. 과하게 스튜디오틱하거나 번쩍이는 상업 광고 느낌은 피한다.
- 오렌지(#ff4800 계열) 포인트 컬러가 은은하게 어울리는 깨끗하고 트렌디한 색감으로 정돈한다.`

const FORMAT_FEED = `[포맷 — 피드 1:1 정사각]
- 정확히 1:1 정사각 구도. 메인 오브제를 화면 중앙~하단에 안정적으로 배치하고, 상단(또는 한쪽)에 카피가 얹힐 넓고 깨끗한 여백을 크게 확보한다.
- 톱다운 플랫레이 또는 45도 앵글의 음식/제품 연출. 시선이 메인에 자연스럽게 모이도록 정돈하고, 요소가 많아 어수선해지지 않게 한다.`

const FORMAT_REELS = `[포맷 — 릴스·스토리 9:16 세로]
- 세로로 길쭉한 9:16 구도. 인스타그램 UI가 상단 약 1/4과 하단 일부를 가리므로, 핵심 오브제는 화면 중앙~중하단에 배치한다.
- 상단과 하단에는 카피/버튼이 얹힐 여백을 넉넉히 남기고, 세로 흐름이 시원하게 느껴지는 배경으로 구성한다.`

const STYLE_REALISTIC = `[스타일 — 실사]
- 실사 사진. 자연광이 부드럽게 스며드는 홈쿠킹/가정식 무드의 웜톤. 재료·제품의 질감(윤기, 표면, 색감)이 먹음직스럽고 세련되게 보이도록 한다.
- 합성 느낌 없이 실제 한 자리에서 스타일링해 촬영한 듯한 통일된 조명·그림자·원근감으로 완성한다.`

const STYLE_BLENDER = `[스타일 — 블렌더 3D]
- 2026 감성의 트렌디한 Blender 스타일 3D 렌더. 세미 매트~무광 재질, 과하게 말랑한 클레이 토이 느낌은 지양한다.
- 색상은 경쾌하고 다양하게, 조명은 부드러운 스튜디오 조명으로. 전체를 하나의 통일된 3D 렌더로 완성한다.`

export function systemPromptFor({ format = 'feed', version = 'realistic' } = {}) {
  const fmt = format === 'reels' ? FORMAT_REELS : FORMAT_FEED
  const style = version === 'blender3d' ? STYLE_BLENDER : STYLE_REALISTIC
  return `${COMMON}\n\n${fmt}\n\n${style}`
}

export function buildSnsMessages({ format = 'feed', version = 'realistic', topic = 'free', brief, refCount = 0 }) {
  const fmtObj = SNS_FORMATS.find((f) => f.value === format) || SNS_FORMATS[0]
  const topicObj = SNS_TOPICS.find((t) => t.value === topic)
  const b = brief || {}

  const lines = []
  lines.push(`포맷: ${fmtObj.label}`)
  if (topicObj && topic !== 'free') {
    lines.push(`콘텐츠 주제: ${topicObj.label}${topicObj.hint ? ` (${topicObj.hint})` : ''}`)
  }
  if (b.title) lines.push(`타이틀(분위기 참고, 이미지에 넣지 말 것): ${b.title}`)
  if (b.subtitle) lines.push(`서브 문구(분위기 참고, 이미지에 넣지 말 것): ${b.subtitle}`)
  if (b.concept) lines.push(`컨셉 / 상품 구성: ${b.concept}`)
  const briefText = lines.join('\n')

  const refNote =
    refCount > 0
      ? `

[참조 이미지 ${refCount}장 첨부됨 — 매우 중요]
- 첨부된 참조 이미지에는 실제 상품이 담겨 있다. 각 상품의 외형·형태·색·패키지·라벨·로고를 원본 그대로 유지·반영해 장면에 자연스럽게 배치/합성하고, 상품을 새로 지어내거나 일반화하지 말 것.
- 첨부된 상품이 장면의 메인/핵심 오브제가 되도록 하고, 프롬프트에 "첨부된 참조 상품의 실제 외형·패키지·로고를 그대로 사용" 취지를 명시한다.`
      : ''

  const user = `아래 브리프로, 규칙을 지키는 큐마켓 SNS ${fmtObj.label} 메인 비주얼용 이미지 생성 프롬프트 1개를 한국어로 작성해줘.

${briefText}${refNote}

다시 강조: 카피/타이틀/서브문구 "글자"는 이미지에 절대 넣지 말고, 카피가 얹힐 깨끗한 여백을 확보할 것. 단, 컨셉이나 첨부 이미지의 실제 상품 브랜드·제품명·패키지·로고는 그대로 살릴 것. 프롬프트 본문만 출력.`

  return [
    { role: 'system', content: systemPromptFor({ format, version }) },
    { role: 'user', content: user },
  ]
}
