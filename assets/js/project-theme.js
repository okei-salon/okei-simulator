/* OUKEI HUB Project Theme Registry — Ver2.0.3
 * 新規プロジェクト追加時は accent / chart / logo を登録するだけで各画面に反映。
 */

var PJ_THEME_REGISTRY = {
  ram: {
    accent: '#f97316',
    accentMid: '#fb923c',
    accentDeep: '#c2410c',
    accentLight: '#fdba74',
    accentSoft: 'rgba(249, 115, 22, .42)',
    accentBorder: 'rgba(251, 146, 60, .38)',
    accentGlow: 'rgba(249, 115, 22, .45)',
    chart: '#f97316',
    dot: '#f97316'
  },
  orca: {
    accent: '#3b82f6',
    accentMid: '#60a5fa',
    accentDeep: '#2563eb',
    accentLight: '#93c5fd',
    accentSoft: 'rgba(59, 130, 246, .42)',
    accentBorder: 'rgba(59, 130, 246, .28)',
    accentGlow: 'rgba(59, 130, 246, .45)',
    chart: '#3b82f6',
    dot: '#3b82f6'
  },
  eni: {
    accent: '#a3e635',
    accentMid: '#84cc16',
    accentDeep: '#65a30d',
    accentLight: '#bef264',
    accentSoft: 'rgba(163, 230, 53, .38)',
    accentBorder: 'rgba(163, 230, 53, .34)',
    accentGlow: 'rgba(132, 204, 22, .42)',
    chart: '#a3e635',
    dot: '#a3e635',
    orgImplemented: false
  },
  cary: {
    accent: '#a855f7',
    accentMid: '#c084fc',
    accentDeep: '#7e22ce',
    accentLight: '#e9d5ff',
    accentSoft: 'rgba(168, 85, 247, .38)',
    accentBorder: 'rgba(168, 85, 247, .32)',
    accentGlow: 'rgba(168, 85, 247, .42)',
    chart: '#a855f7',
    dot: '#a855f7'
  },
  genesis: {
    accent: '#eab308',
    accentMid: '#facc15',
    accentDeep: '#ca8a04',
    accentLight: '#fde047',
    accentSoft: 'rgba(234, 179, 8, .38)',
    accentBorder: 'rgba(234, 179, 8, .32)',
    accentGlow: 'rgba(234, 179, 8, .42)',
    chart: '#eab308',
    dot: '#eab308'
  },
  other: {
    accent: '#64748b',
    accentMid: '#94a3b8',
    accentDeep: '#475569',
    accentLight: '#cbd5e1',
    accentSoft: 'rgba(100, 116, 139, .32)',
    accentBorder: 'rgba(100, 116, 139, .28)',
    accentGlow: 'rgba(100, 116, 139, .35)',
    chart: '#64748b',
    dot: '#64748b'
  }
};

var PJ_SCOPE_CHART_DEFAULT = '#60a5fa';

function pjGetTheme(projectKey) {
  return PJ_THEME_REGISTRY[projectKey] || PJ_THEME_REGISTRY.other;
}

function pjGetAccentColor(projectKey) {
  return pjGetTheme(projectKey).accent;
}

function pjGetChartColor(projectKey) {
  return pjGetTheme(projectKey).chart || pjGetAccentColor(projectKey);
}

function pjGetDotColor(projectKey) {
  return pjGetTheme(projectKey).dot || pjGetChartColor(projectKey);
}

function pjGetBarGradient(projectKey) {
  let t = pjGetTheme(projectKey);
  return 'linear-gradient(90deg, ' + (t.accentDeep || t.accent) + ', ' + t.accent + ', ' + (t.accentLight || t.accentMid || t.accent) + ')';
}

function pjGetAccentBorderHover(projectKey) {
  let t = pjGetTheme(projectKey);
  if (t.accentBorderHover) return t.accentBorderHover;
  let m = String(t.accentBorder).match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!m) return t.accentBorder;
  let alpha = Math.min(1, parseFloat(m[4]) * 1.35);
  return 'rgba(' + m[1] + ', ' + m[2] + ', ' + m[3] + ', ' + alpha.toFixed(2) + ')';
}

function pjGetScopeChartColor(projectKey) {
  if (!projectKey || projectKey === 'all') return PJ_SCOPE_CHART_DEFAULT;
  return pjGetChartColor(projectKey);
}

function pjIsOrgChartImplemented(projectKey) {
  let t = pjGetTheme(projectKey);
  if (typeof t.orgImplemented === 'boolean') return t.orgImplemented;
  return projectKey === 'ram' || projectKey === 'orca';
}

function pjBuildOrgSelectCardBg(projectKey) {
  let t = pjGetTheme(projectKey);
  let bg = 'linear-gradient(180deg, #13243d, #0d1b30)';
  return bg + ' padding-box, linear-gradient(135deg, ' + t.accentBorder + ', ' + t.accentSoft + ') border-box';
}

function pjBuildDynamicThemeCss() {
  let css = [];
  Object.keys(PJ_THEME_REGISTRY).forEach(function (key) {
    let t = pjGetTheme(key);
    let grad = pjGetBarGradient(key);
    let hoverBorder = pjGetAccentBorderHover(key);
    let dot = pjGetDotColor(key);
    let chart = pjGetChartColor(key);
    let emph = t.accentLight || t.accentMid || t.accent;
    let glowLine = t.accentMid || t.accent;

    css.push('.homeMonthlyProjCard--' + key + ',.homeMonthlyCard .homeMonthlyProjCard--' + key + '{border-color:' + t.accentBorder + '}');
    css.push('.homeMonthlyProjCard--' + key + ' .homeMonthlyProjCardBarFill,.homeMonthlyCard .homeMonthlyProjCard--' + key + ' .homeMonthlyProjCardBarFill{background:' + grad + '}');

    css.push('.homeTodayProjCard--' + key + ',.homeTodayCard .homeTodayProjCard--' + key + '{border-color:' + t.accentBorder + '}');
    css.push('.homeTodayProjCard--' + key + ' .homeTodayProjCardBarFill,.homeTodayCard .homeTodayProjCard--' + key + ' .homeTodayProjCardBarFill{background:' + grad + '}');

    css.push('.homeProjCard--' + key + '{border-color:' + t.accentBorder + '}');
    css.push('.homeProjCard--' + key + ' .homeProjCardDot{background:' + dot + '}');
    css.push('.homeProjCard--' + key + ' .homeProjCardBarFill{background:' + grad + '}');
    css.push('.homeProjDot.' + key + '{background:' + dot + '}');

    css.push('.revenueProjectCard--' + key + '{border-color:' + t.accentBorder + '}');
    css.push('.revenueProjectCard--' + key + ':hover{border-color:' + hoverBorder + ';box-shadow:0 0 20px ' + t.accentGlow + '}');

    css.push('.pfProjectCard--' + key + '{border-color:' + t.accentBorder + '}');
    css.push('.pfProjectCard--' + key + '.isClickable:hover{border-color:' + hoverBorder + '}');
    css.push('.pfProfitDetail--' + key + ' .pfProfitDetailVal--emph{color:' + emph + '}');
    css.push('.pfProfitDetail--' + key + ' .pfProfitDetailSectionTitle{color:' + emph + '}');
    css.push('.pfStackSeg--' + key + '{background:' + chart + ' !important}');
    css.push('.pfProfitPieBlock--' + key + ' .pfProfitPieHole{border-color:#0d1b30}');

    css.push('.ramInputBadge--' + key + '{background:' + t.accentSoft + ';border-color:' + t.accentBorder + ';color:' + emph + '}');

    css.push('.orgSelectCard--' + key + '{background:' + pjBuildOrgSelectCardBg(key) + '}');
    css.push('.orgSelectCard--' + key + '::before{background:linear-gradient(90deg, transparent, ' + glowLine + ', transparent);box-shadow:0 0 18px ' + t.accentGlow + '}');

    css.push('[data-rm-scope="' + key + '"] .rmCompareLegendItem i.isCurrent,[data-sm-scope="' + key + '"] .rmCompareLegendItem i.isCurrent{background:' + chart + '}');
  });
  return css.join('\n');
}

function pjInjectThemeStyleSheet() {
  if (typeof document === 'undefined') return;
  let id = 'pjDynamicThemeStyles';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = pjBuildDynamicThemeCss();
}

function pjInitProjectTheme() {
  pjInjectThemeStyleSheet();
}

if (typeof window !== 'undefined') {
  window.PJ_THEME_REGISTRY = PJ_THEME_REGISTRY;
  window.pjGetTheme = pjGetTheme;
  window.pjGetAccentColor = pjGetAccentColor;
  window.pjGetChartColor = pjGetChartColor;
  window.pjGetDotColor = pjGetDotColor;
  window.pjGetBarGradient = pjGetBarGradient;
  window.pjGetScopeChartColor = pjGetScopeChartColor;
  window.pjIsOrgChartImplemented = pjIsOrgChartImplemented;
  window.pjInitProjectTheme = pjInitProjectTheme;
  pjInitProjectTheme();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pjInitProjectTheme);
  }
}
