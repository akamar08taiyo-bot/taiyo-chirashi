import type { AuthSession } from '../types.js';
import { icon } from './icons.js';

export function topbar(session: AuthSession, options: { editor?:boolean; saveHtml?:string } = {}): string {
  const initial = session.profile.displayName.trim().charAt(0) || '社';
  return `<header class="topbar">
    <button class="brand-link" data-nav="home" aria-label="ホームへ">${icon('sun',28,'brand-sun')}<strong>太陽シルバーサービス</strong><span>事例集・チラシ作成</span></button>
    <div class="top-actions">
      ${options.editor ? `<div id="top-save-status" class="autosave-chip">${options.saveHtml??`${icon('check',14)} 保存済み`}</div><button class="top-btn" id="undo-btn">${icon('undo',17)}<span>戻す</span></button><button class="top-btn" id="redo-btn">${icon('redo',17)}<span>やり直す</span></button>` : `<nav class="top-nav"><button data-nav="home">ホーム</button><button data-nav="templates">テンプレート</button><button data-nav="media">写真ライブラリ</button>${session.profile.role!=='employee'?'<button data-nav="admin">管理</button>':''}</nav>`}
      <button class="top-btn help-button" id="help-btn">${icon('help',17)}<span>使い方</span></button>
      <div class="profile-menu-wrap"><button class="profile-button" id="profile-button"><span class="avatar">${initial}</span><span><strong>${session.profile.displayName}</strong><small>${roleLabel(session.profile.role)}</small></span><span class="caret">⌄</span></button>
      <div class="profile-popover" id="profile-popover"><button data-nav="home">${icon('home',16)}ホーム</button><button data-nav="trash">${icon('trash',16)}ゴミ箱</button><button id="logout-btn">${icon('logout',16)}ログアウト</button></div></div>
    </div>
  </header>`;
}
function roleLabel(role: AuthSession['profile']['role']): string { return role==='org_admin'?'全社管理者':role==='office_admin'?'営業所管理者':'一般社員'; }
