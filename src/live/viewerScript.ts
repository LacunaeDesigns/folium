// The live-session layer injected into HTML exports. Vanilla JS, runs after the
// base viewer script; PeerJS UMD is prepended separately.
export const VIEWER_LIVE_JS = `
(function(){
  if (typeof Peer === 'undefined') return;
  var bar = document.getElementById('livebar');
  bar.style.display = 'inline-flex';
  bar.style.gap = '8px';
  bar.innerHTML = '<button id="joinbtn">Join live session</button>';
  var conn = null, myName = '', commentMode = false;

  function status(html){ bar.innerHTML = html; }

  function esc2(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

  function send(msg){ if(conn && conn.open) conn.send(msg); }

  function mergeCards(cards){
    cards.forEach(function(sc){
      var found = null;
      for (var i=0;i<DATA.cards.length;i++){ if(DATA.cards[i].id===sc.id){ found=DATA.cards[i]; break; } }
      if (found){
        found.content = sc.content; found.x = sc.x; found.y = sc.y; found.w = sc.w; found.h = sc.h;
      } else {
        sc.trashed = false; sc.inUnsorted = false;
        DATA.cards.push(sc);
      }
    });
    render(); decorate();
  }

  function decorate(){
    if(!conn || !conn.open) return;
    // reply inputs on comment cards
    document.querySelectorAll('.cmt').forEach(function(el){
      if (el.querySelector('.live-reply')) return;
      var host = el.closest('[data-card]');
      if (!host) return;
      var input = document.createElement('input');
      input.className = 'live-reply';
      input.placeholder = 'Reply…';
      input.style.cssText = 'width:100%;margin-top:7px;border:1px solid var(--border);border-radius:12px;padding:5px 9px;font:inherit;font-size:12px;background:var(--chrome);color:var(--ink)';
      input.addEventListener('keydown', function(ev){
        if (ev.key==='Enter' && input.value.trim()){
          send({ t:'reply-add', cardId: host.getAttribute('data-card'), text: input.value.trim(), author: myName, ts: Date.now() });
          input.value=''; input.placeholder='Sent ✓';
        }
      });
      el.appendChild(input);
    });
  }

  function connect(){
    var code = (prompt('Session code (from the reviewer\\u2019s AtlasNote):')||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    if (!code) return;
    myName = (prompt('Your name:')||'Reviewer').slice(0,60);
    status('<span style="color:var(--faint);font-size:12px">Connecting…</span>');
    var peer = new Peer();
    peer.on('open', function(){
      conn = peer.connect('atlasnote-'+code, { reliable: true });
      conn.on('open', function(){
        conn.send({ t:'hello', name: myName });
      });
      conn.on('data', function(msg){
        if (!msg) return;
        if (msg.t === 'welcome'){
          status('<span style="color:#4caf6e;font-weight:600;font-size:12px">● Live with '+esc2(msg.hostName)+'</span> <button id="cmtbtn">+ Comment</button>');
          decorate();
        } else if (msg.t === 'cards-sync'){
          mergeCards(msg.cards);
        }
      });
      conn.on('close', function(){ status('<span style="color:var(--faint);font-size:12px">Session ended</span>'); conn=null; });
      conn.on('error', function(){ status('<span style="color:#d64541;font-size:12px">Connection failed</span> <button id="joinbtn">Retry</button>'); conn=null; });
    });
    peer.on('error', function(e){
      status('<span style="color:#d64541;font-size:12px">'+esc2(e.type||'error')+'</span> <button id="joinbtn">Retry</button>');
    });
  }

  document.addEventListener('click', function(e){
    if (e.target.id === 'joinbtn'){ connect(); return; }
    if (e.target.id === 'cmtbtn'){
      commentMode = !commentMode;
      e.target.style.color = commentMode ? '#e56937' : '';
      document.getElementById('world').style.cursor = commentMode ? 'crosshair' : '';
      return;
    }
    if (!conn || !conn.open) return;

    // live pin replies inside a freshly-opened pin popover
    var pop = document.querySelector('.pinpop');
    if (pop && !pop.querySelector('.live-reply')){
      var pinBtn = e.target.closest('[data-pin]');
      if (pinBtn){
        var parts = pinBtn.getAttribute('data-pin').split(':');
        var card = DATA.cards.filter(function(c){return c.id===parts[0];})[0];
        var pin = card && card.content.pins[Number(parts[1])];
        if (pin){
          var input = document.createElement('input');
          input.className='live-reply'; input.placeholder='Reply…';
          input.style.cssText='width:100%;margin-top:7px;border:1px solid var(--border);border-radius:12px;padding:5px 9px;font:inherit;font-size:12px';
          input.addEventListener('keydown', function(ev){
            if (ev.key==='Enter' && input.value.trim()){
              send({ t:'reply-add', cardId: card.id, pinId: pin.id, text: input.value.trim(), author: myName, ts: Date.now() });
              input.value=''; input.placeholder='Sent ✓';
            }
          });
          pop.appendChild(input);
        }
        return;
      }
    }

    // add a pin to an image while in comment mode
    if (commentMode){
      var wrap = e.target.closest('figure.img .wrap');
      if (wrap && e.target.tagName === 'IMG'){
        var host = wrap.closest('[data-card]');
        var r = e.target.getBoundingClientRect();
        if (!r.width || !r.height) return; // image not laid out yet
        var text = prompt('Comment on this spot:');
        if (text && text.trim()){
          send({ t:'pin-add', cardId: host.getAttribute('data-card'), fx:(e.clientX-r.left)/r.width, fy:(e.clientY-r.top)/r.height, text:text.trim(), author: myName, ts: Date.now() });
        }
        commentMode = false;
        var btn = document.getElementById('cmtbtn'); if(btn) btn.style.color='';
        document.getElementById('world').style.cursor='';
        return;
      }
      // or drop a comment card on the canvas
      var world = document.getElementById('world');
      if (world && (e.target === world || world.contains(e.target)) && !e.target.closest('.card')){
        var wr = world.getBoundingClientRect();
        var scale = wr.width / world.offsetWidth;
        var off = window.__offs || { offX: 0, offY: 0 };
        var text2 = prompt('Your comment:');
        if (text2 && text2.trim()){
          send({ t:'comment-add', boardId: current, x:(e.clientX-wr.left)/scale + off.offX, y:(e.clientY-wr.top)/scale + off.offY, text:text2.trim(), author: myName, ts: Date.now() });
        }
        commentMode = false;
        var btn2 = document.getElementById('cmtbtn'); if(btn2) btn2.style.color='';
        world.style.cursor='';
      }
    }
  });
})();
`
