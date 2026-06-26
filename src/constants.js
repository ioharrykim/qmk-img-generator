// 마케팅챕터 이미지 스튜디오 — 상수 정의

export const COLORS = {
  accent: '#ff4800',
  accentBg: '#fff1eb',
  accentBorder: '#ff4800',
  text: '#222222',
  subtle: '#6a6a6a',
  border: '#dddddd',
  divider: '#ebebeb',
  canvas: '#f7f7f7',
  surface: '#ffffff',
  placeholder: '#dddddd',
}

export const STORAGE_KEYS = {
  settings: 'qimg.settings',
  apiKey: 'qimg.apiKey',
  presets: 'qimg.presets',
  krwRate: 'qimg.krwRate',
  qmarket: 'qimg.qmarket',
  typography: 'qimg.typography',
}

export const DEFAULT_SETTINGS = {
  prompt: '',
  negative: '',
  styles: [],
  size: '1024x1024',
  quality: 'high',
  background: 'opaque',
  format: 'png',
  compression: 85,
  n: 1,
  moderation: 'auto',
  model: 'gpt-image-2',
  promptModel: 'gpt-5.5',
  customW: 1024,
  customH: 1024,
  useCustomSize: false,
}

// 저장(localStorage)할 설정 필드 — 휘발성 UI 상태는 제외. 프리셋 스냅샷에도 동일하게 사용.
export const PERSISTED_FIELDS = [
  'prompt',
  'negative',
  'styles',
  'size',
  'quality',
  'background',
  'format',
  'compression',
  'n',
  'moderation',
  'model',
  'promptModel',
  'customW',
  'customH',
  'useCustomSize',
]

// 스타일 카테고리
export const STYLE_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'commerce', label: '커머스' },
  { key: 'photo', label: '사진' },
  { key: 'illust', label: '일러스트' },
  { key: 'graphic', label: '3D·그래픽' },
]

// 스타일 프리셋 — 클릭 시 프롬프트 뒤에 suffix 가 덧붙는다(중복 적용 가능)
// cat: 카테고리 키, hint: 짧은 설명(툴팁)
export const STYLES = [
  // 커머스 (큐마켓/이커머스용)
  { key: 'white_bg', cat: 'commerce', label: '화이트 배경 제품컷', hint: '순백 배경 스튜디오 제품 사진', suffix: 'professional e-commerce product photo on pure white seamless background, studio softbox lighting, centered, sharp focus, no props' },
  { key: 'lifestyle', cat: 'commerce', label: '라이프스타일 연출컷', hint: '실사용 상황 연출', suffix: 'lifestyle product photography, product used in a natural real-life setting, soft daylight, cozy styled scene' },
  { key: 'flatlay', cat: 'commerce', label: '플랫레이', hint: '위에서 내려다본 구성', suffix: 'flat lay top-down composition, neatly arranged product with styled props, even soft lighting, marketing layout' },
  { key: 'model', cat: 'commerce', label: '모델 착용/사용컷', hint: '모델이 착용·사용', suffix: 'model wearing or using the product, clean studio background, fashion lookbook lighting, natural pose' },
  { key: 'thumbnail', cat: 'commerce', label: '썸네일 강조', hint: '시선 끄는 썸네일', suffix: 'eye-catching marketplace thumbnail, single bold focal subject, high contrast, vibrant punchy colors, clean background' },
  { key: 'detail', cat: 'commerce', label: '상세컷(접사)', hint: '디테일/질감 강조', suffix: 'extreme close-up macro detail shot, emphasizing texture and material quality, crisp focus' },
  { key: 'product', cat: 'commerce', label: '제품 목업', hint: '깔끔한 제품 목업', suffix: 'professional product mockup photography, studio lighting, clean seamless background' },
  { key: 'logo', cat: 'commerce', label: '로고 / 엠블럼', hint: '미니멀 벡터 로고', suffix: 'minimal vector logo emblem, flat, centered, simple' },

  // 사진
  { key: 'realistic', cat: 'photo', label: '실사 사진', hint: '초고해상 실사', suffix: 'photorealistic, ultra detailed, natural lighting, 8k' },
  { key: 'film', cat: 'photo', label: '빈티지 필름', hint: '35mm 필름 감성', suffix: 'vintage 35mm film photo, grain, faded warm tones' },
  { key: 'bw', cat: 'photo', label: '흑백 사진', hint: '고대비 모노크롬', suffix: 'black and white photography, high contrast dramatic monochrome' },
  { key: 'neon', cat: 'photo', label: '네온 사이버펑크', hint: '네온/미래적', suffix: 'cyberpunk, glowing neon lighting, futuristic atmosphere' },

  // 일러스트
  { key: 'illust', cat: 'illust', label: '플랫 일러스트', hint: '깔끔한 벡터', suffix: 'flat vector illustration, clean bold shapes, minimal' },
  { key: 'anime', cat: 'illust', label: '애니메이션', hint: '셀 셰이딩 애니', suffix: 'anime style, vibrant colors, cel shading, crisp lineart' },
  { key: 'water', cat: 'illust', label: '수채화', hint: '부드러운 수채', suffix: 'watercolor painting, soft color washes, paper texture' },
  { key: 'line', cat: 'illust', label: '미니멀 라인', hint: '단선 라인아트', suffix: 'minimal single-weight line art on clean background' },
  { key: 'oil', cat: 'illust', label: '유화', hint: '붓터치 유화', suffix: 'oil painting, visible brush strokes, rich textured canvas' },
  { key: 'sketch', cat: 'illust', label: '연필 스케치', hint: '손그림 스케치', suffix: 'detailed pencil sketch, hand-drawn graphite shading' },
  { key: 'pop', cat: 'illust', label: '팝아트', hint: '하프톤 팝아트', suffix: 'pop art, bold flat colors, halftone dots, comic style' },
  { key: 'story', cat: 'illust', label: '동화책', hint: '따뜻한 그림책', suffix: 'storybook illustration, soft warm whimsical, children book style' },
  { key: 'poster', cat: 'illust', label: '그래픽 포스터', hint: '타이포 포스터', suffix: 'graphic poster design, bold typographic composition, flat shapes' },

  // 3D·그래픽
  { key: '3d', cat: 'graphic', label: '3D 렌더', hint: '옥테인 렌더', suffix: '3D render, octane render, soft studio lighting, high detail' },
  { key: 'iso', cat: 'graphic', label: '아이소메트릭', hint: '등각 3D', suffix: 'isometric illustration, clean geometric 3D, soft shadows' },
  { key: 'lowpoly', cat: 'graphic', label: '로우폴리', hint: '저폴리곤', suffix: 'low poly 3D, faceted geometric shapes, flat shading' },
  { key: 'clay', cat: 'graphic', label: '클레이', hint: '점토/스톱모션', suffix: 'claymation style, handmade clay texture, stop-motion look' },
  { key: 'pixel', cat: 'graphic', label: '픽셀 아트', hint: '16비트 레트로', suffix: 'pixel art, 16-bit retro game style, crisp pixels' },
]

// 용도 프리셋 — 사이즈/품질/포맷/배경을 한 번에 적용
export const USECASES = [
  { key: 'sns', label: 'SNS 정사각', desc: '1:1 · 고품질', patch: { size: '1024x1024', quality: 'high', format: 'png', background: 'opaque' } },
  { key: 'banner', label: '가로 배너', desc: '3:2 · 고품질', patch: { size: '1536x1024', quality: 'high', format: 'png', background: 'opaque' } },
  { key: 'poster', label: '세로 포스터', desc: '2:3 · 고품질', patch: { size: '1024x1536', quality: 'high', format: 'png', background: 'opaque' } },
  { key: 'icon', label: '투명 아이콘', desc: '1:1 · PNG 투명', patch: { size: '1024x1024', quality: 'high', format: 'png', background: 'transparent' } },
]

// 비율 / 사이즈 프리셋 (스와치 크기 포함)
export const SIZE_DEFS = [
  { value: '1024x1024', label: '정사각', sub: '1:1 · 1024px', swW: '16px', swH: '16px' },
  { value: '1536x1024', label: '가로', sub: '3:2 · 1536px', swW: '20px', swH: '14px' },
  { value: '1024x1536', label: '세로', sub: '2:3 · 1536px', swW: '14px', swH: '20px' },
  { value: '1792x1024', label: '와이드', sub: '16:9 · 1792px', swW: '22px', swH: '12px' },
  { value: '1024x1792', label: '롱', sub: '9:16 · 1792px', swW: '12px', swH: '22px' },
  { value: 'auto', label: '자동', sub: '모델이 선택', swW: '16px', swH: '16px' },
]

export const QUALITY_OPTIONS = [
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '보통' },
  { value: 'high', label: '높음' },
  { value: 'auto', label: '자동' },
]

export const BACKGROUND_OPTIONS = [
  { value: 'opaque', label: '불투명' },
  { value: 'transparent', label: '투명' },
  { value: 'auto', label: '자동' },
]

export const FORMAT_OPTIONS = [
  { value: 'png', label: 'png' },
  { value: 'jpeg', label: 'jpeg' },
  { value: 'webp', label: 'webp' },
]

export const COUNT_OPTIONS = [
  { value: 1, label: '1장' },
  { value: 2, label: '2장' },
  { value: 3, label: '3장' },
  { value: 4, label: '4장' },
]

export const MODERATION_OPTIONS = [
  { value: 'auto', label: '기본' },
  { value: 'low', label: '완화' },
]
