// 타이포그래피 프리셋 — 입력값을 프롬프트로 "조립"(AI 미사용)
// 사용자가 실제로 쓰던 프롬프트 패턴을 그대로 템플릿화한 것.

export const DEFAULT_TYPOGRAPHY = {
  enabled: false,
  line1: '',
  line2: '',
  line3: '',
  emphasis: 'equal', // 'equal' | 'line1' | 'line2' | 'line3'
  colorDesign: '',
  background: '',
  count: 4,
}

export const TYPO_COUNT_OPTIONS = [
  { value: 1, label: '1개' },
  { value: 2, label: '2개' },
  { value: 3, label: '3개' },
  { value: 4, label: '4개' },
]

// 시안 개수별 자동 이미지 사이즈 (gpt-image-2 커스텀 사이즈: 16배수·비율≤3:1·픽셀 65만~829만)
export const COUNT_SIZE = {
  1: { w: 1536, h: 1152, ratio: '4:3' }, // 단일
  2: { w: 1792, h: 896, ratio: '2:1' }, // 가로 2분할
  3: { w: 1024, h: 1536, ratio: '2:3' }, // 세로 3단
  4: { w: 1792, h: 896, ratio: '2:1' }, // 2×2 (넓은 셀)
}

export function sizeForCount(count) {
  return COUNT_SIZE[count] || COUNT_SIZE[4]
}

// 현재 입력된 줄을 기준으로 강조 선택지를 만든다 (동등 + 채워진 줄들)
export function emphasisOptions(t) {
  const opts = [{ value: 'equal', label: '동등하게' }]
  ;['line1', 'line2', 'line3'].forEach((key, i) => {
    if ((t[key] || '').trim()) opts.push({ value: key, label: `${i + 1}번째 줄 강조` })
  })
  return opts
}

export function buildTypographyPrompt(t) {
  const lines = [t.line1, t.line2, t.line3].map((s) => (s || '').trim()).filter(Boolean)
  if (!lines.length) return ''

  const count = t.count || 4
  const colorDesign = (t.colorDesign || '').trim()
  const background = (t.background || '').trim() || '흰색'

  const emMap = { line1: t.line1, line2: t.line2, line3: t.line3 }
  const emLine = (emMap[t.emphasis] || '').trim()
  const emphasis =
    t.emphasis && t.emphasis !== 'equal' && emLine
      ? `위 타이포그래피에서 "${emLine}"를 더 크게 하고 포인트를 준`
      : '위 타이포그래피를 균형 있게 배치하고 포인트를 준'

  const colorLine = colorDesign
    ? `메인 색상과 디자인은 ${colorDesign}에 걸맞게 사용해줘. 트렌디하고 미감 좋은 타이포그래피 시안들로 만들어줘.`
    : '메인 색상과 디자인은 문구 분위기에 어울리게, 트렌디하고 미감 좋은 타이포그래피 시안들로 만들어줘.'

  return `${lines.join('\n')}

${emphasis} 한글 타이포그래피 시안을 ${count}개 만들어줘.

${colorLine}
배경은 ${background}으로 설정해줘.`
}
