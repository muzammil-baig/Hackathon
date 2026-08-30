// ConvoMemory content script — runs on https://claude.ai/*
(function () {
  'use strict';

  function extractMessages() {
    const messages = [];
    let index = 0;

    // Method 1: fieldset/data-testid patterns for Claude.ai
    const humanSel = [
      '[data-testid="user-human-turn"]',
      '[data-testid*="human-turn"]',
      '.human-turn',
      '[class*="HumanTurn"]',
    ];
    const assistantSel = [
      '[data-testid="assistant-message"]',
      '[data-testid*="assistant-turn"]',
      '.assistant-turn',
      '[class*="AssistantTurn"]',
    ];

    // Try pairing
    const humanEls = humanSel.flatMap(s => [...document.querySelectorAll(s)]);
    const assistantEls = assistantSel.flatMap(s => [...document.querySelectorAll(s)]);

    if (humanEls.length + assistantEls.length > 0) {
      const all = [
        ...humanEls.map(el => ({ el, role: 'human' })),
        ...assistantEls.map(el => ({ el, role: 'assistant' })),
      ].sort((a, b) => a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1);

      for (const { el, role } of all) {
        const text = el.innerText?.trim();
        if (text && text.length > 2) {
          messages.push({ role, text, index: index++ });
        }
      }
    }

    // Method 2: Generic conversation container scan
    if (messages.length === 0) {
      const containers = [
        document.querySelector('[class*="ConversationItem"]'),
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
      ].filter(Boolean);

      for (const container of containers) {
        const divs = container.querySelectorAll('div[class*="message"], div[class*="turn"], div[class*="chat-item"]');
        divs.forEach(div => {
          const text = div.innerText?.trim();
          if (text && text.length > 10) {
            messages.push({ role: 'human', text, index: index++ });
          }
        });
        if (messages.length > 0) break;
      }
    }

    // Method 3: Look for alternating p tags in main content
    if (messages.length === 0) {
      const main = document.querySelector('main') || document.body;
      const paras = [...main.querySelectorAll('p')].filter(p => p.innerText?.trim().length > 20);
      paras.forEach((p, i) => {
        messages.push({ role: i % 2 === 0 ? 'human' : 'assistant', text: p.innerText.trim(), index: index++ });
      });
    }

    return messages;
  }

  function getMessageCount() {
    return document.querySelectorAll(
      '[data-testid*="turn"], [class*="turn"], [class*="message"], [class*="chat-item"]'
    ).length;
  }

  function injectBadge() {
    const old = document.getElementById('convomemory-badge');
    if (old) old.remove();

    const badge = document.createElement('div');
    badge.id = 'convomemory-badge';
    badge.textContent = 'Memory Indexed';
    Object.assign(badge.style, {
      position: 'fixed', top: '14px', right: '14px',
      background: '#10B981', color: '#fff',
      padding: '4px 12px', borderRadius: '4px',
      fontFamily: 'monospace', fontSize: '12px', fontWeight: '600',
      zIndex: '99999', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      cursor: 'pointer', transition: 'opacity 0.4s',
    });
    badge.onclick = () => badge.remove();
    document.body.appendChild(badge);

    setTimeout(() => {
      badge.style.opacity = '0';
      setTimeout(() => badge.remove(), 400);
    }, 5000);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'EXTRACT_MESSAGES') {
      const msgs = extractMessages();
      if (msgs.length > 0) {
        sendResponse({ success: true, messages: msgs, count: msgs.length });
      } else {
        sendResponse({ success: false, error: 'DOM extraction failed — try pasting text manually' });
      }
      return true;
    }

    if (msg.type === 'GET_LINE_COUNT') {
      sendResponse({ count: getMessageCount() });
      return true;
    }

    if (msg.type === 'INDEX_COMPLETE') {
      injectBadge();
      sendResponse({ success: true });
      return true;
    }
  });
})();
