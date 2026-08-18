import type { EditorState, FlyerMode, ValidationIssue } from '../types.js';

const textLimitByLayout: Record<number, { title: number; description: number }> = {
  1: { title: 70, description: 500 }, 2: { title: 50, description: 330 }, 3: { title: 40, description: 260 },
  4: { title: 34, description: 180 }, 6: { title: 30, description: 135 }, 9: { title: 28, description: 105 }
};

export function validateEditorState(state: EditorState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!state.title.trim()) issues.push({ code: 'title_required', message: 'チラシのタイトルを入力してください。', itemIndex: null, severity: 'error' });
  const limits = textLimitByLayout[state.layoutCount] ?? { title: 28, description: 105 };
  state.items.slice(0, state.layoutCount).forEach((item, index) => {
    const itemLabel=state.mode==='consumables'?`商品${String(index+1).padStart(2,'0')}`:`写真${String(index+1).padStart(2,'0')}`;
    if (!item.media?.previewUrl && !item.media?.localBlobKey) issues.push({ code: `photo_${index}`, message: `${itemLabel}の写真が未設定です。`, itemIndex: index, severity: 'warning' });
    if(state.mode==='consumables'){
      if(!item.productName.trim())issues.push({code:`product_required_${index}`,message:`${itemLabel}の商品名を入力してください。`,itemIndex:index,severity:'error'});
      if(item.productName.length>80)issues.push({code:`product_long_${index}`,message:`${itemLabel}の商品名が長すぎます。80文字以内にしてください。`,itemIndex:index,severity:'error'});
      if(item.title.length>50)issues.push({code:`title_long_${index}`,message:`${itemLabel}の見出しが長すぎます。`,itemIndex:index,severity:'error'});
    }else if (item.title.length > limits.title) issues.push({ code: `title_long_${index}`, message: `${itemLabel}のタイトルが長すぎます。`, itemIndex: index, severity: 'error' });
    if (item.description.length > limits.description) issues.push({ code: `description_long_${index}`, message: `${itemLabel}の説明文が長すぎます。`, itemIndex: index, severity: 'error' });
  });
  return issues;
}

export function mergeDomOverflowIssues(issues: ValidationIssue[], overflowIndexes: number[], mode: FlyerMode = 'cases'): ValidationIssue[] {
  const seen = new Set(issues.map((i) => i.code));
  for (const index of overflowIndexes) {
    const code = `dom_overflow_${index}`;
    if (!seen.has(code)) issues.push({ code, message: `${mode==='consumables'?'商品':'写真'}${String(index + 1).padStart(2, '0')}の文章が枠に収まりません。商品名や説明文を短くするか、レイアウトを変更してください。`, itemIndex: index, severity: 'error' });
  }
  return issues;
}
