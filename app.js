(function () {
  'use strict';

  // ------------------------------------------------------------------
  // ODKAZY NA KONZULTACI
  //
  // ODKAZ_BEZNY = veřejná konzultace 90 minut za 5 000 Kč
  // ODKAZ_CLEN  = členská konzultace 30 minut za 1 700 Kč
  //
  // Až budou v rezervačním kalendáři obě služby, přepiš sem jejich adresy.
  // ------------------------------------------------------------------
  var ODKAZ_BEZNY = 'https://www.frimmelovasimona.com/booking-calendar/osobn%C3%AD-konzultace-se-simonou';
  var ODKAZ_CLEN  = 'https://www.frimmelovasimona.com/booking-calendar/%C4%8Dlensk%C3%A1-konzultace-30-minut';

  // ------------------------------------------------------------------
  // ČLENSKÝ REŽIM
  //
  // Členská cena se ukáže JEN tehdy, když je stránka otevřená s ?clen
  // na konci adresy. Takový odkaz patří výhradně do komunity:
  //
  //   veřejně  …/priority/
  //   členům   …/priority/?clen
  //
  // Bez toho stránka ukazuje jen běžnou cenu, takže členská nabídka
  // zůstane opravdu jen pro členy.
  // ------------------------------------------------------------------
  var JE_CLEN = /(^|[?&])clen(=|&|$)/.test(location.search);

  // ------------------------------------------------------------------
  // KDY JE VEŘEJNÝ PLÁNOVAČ OTEVŘENÝ
  //
  // Pravidelně: první neděle v měsíci a pondělí po ní.
  // Navíc jednorázové okno níž — rozjezd.
  //
  // Členská verze (?clen) se NEZAVÍRÁ nikdy, to je smysl členství.
  //
  // Změnit rozjezd: přepiš ROZJEZD. Měsíc se píše od nuly,
  // takže listopad = 10, prosinec = 11, leden = 0.
  // Vypnout zavírání úplně: dát ZAVÍRAT = false.
  // ------------------------------------------------------------------
  var ZAVIRAT  = true;
  var ROZJEZD  = { rok: 2026, mesic: 10, odeDne: 15, doDne: 16 };

  function denOd(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function prvniNedele(rok, mesic) {
    var prvni = new Date(rok, mesic, 1);
    return new Date(rok, mesic, 1 + ((7 - prvni.getDay()) % 7));
  }

  // Začátek nejbližšího okna od zadaného dne (včetně).
  function dalsiOkno(ode) {
    var n = prvniNedele(ode.getFullYear(), ode.getMonth());
    if (n.getTime() < ode.getTime()) {
      n = prvniNedele(ode.getFullYear(), ode.getMonth() + 1);
    }
    return n;
  }

  function otevreno(ted) {
    if (!ZAVIRAT || JE_CLEN) return true;

    var dnes = denOd(ted || new Date());

    var od = new Date(ROZJEZD.rok, ROZJEZD.mesic, ROZJEZD.odeDne);
    var doo = new Date(ROZJEZD.rok, ROZJEZD.mesic, ROZJEZD.doDne);
    if (dnes.getTime() >= od.getTime() && dnes.getTime() <= doo.getTime()) return true;

    // první neděle v měsíci
    if (dnes.getDay() === 0) {
      if (prvniNedele(dnes.getFullYear(), dnes.getMonth()).getTime() === dnes.getTime()) return true;
    }
    // pondělí hned po ní (klidně i přes přelom měsíce)
    if (dnes.getDay() === 1) {
      var vcera = new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate() - 1);
      if (prvniNedele(vcera.getFullYear(), vcera.getMonth()).getTime() === vcera.getTime()) return true;
    }

    return false;
  }

  var MESICE = ['ledna', '\u00fanora', 'b\u0159ezna', 'dubna', 'kv\u011btna', '\u010dervna',
                '\u010dervence', 'srpna', 'z\u00e1\u0159\u00ed', '\u0159\u00edjna', 'listopadu', 'prosince'];

  function zavri() {
    var i, bloky = document.querySelectorAll('.otevreno');
    for (i = 0; i < bloky.length; i++) { bloky[i].style.display = 'none'; }

    var dalsi = dalsiOkno(denOd(new Date()));
    var popis = 'v ned\u011bli ' + dalsi.getDate() + '. ' + MESICE[dalsi.getMonth()];
    var pole = el('zavDatum');
    if (pole) { pole.textContent = popis; }

    el('zavreno').style.display = 'block';
  }


  var CENA = {
    bezny: { popis: 'Osobní konzultace, 90 minut', pozn: 'co za ni platí ostatní', kc: '5 000 Kč' },
    clen:  { popis: 'Tvoje cena v komunitě — 30 minut', pozn: 'nikde jinde to nenajdeš', kc: '1 700 Kč' }
  };

  var KEY = 'sf-prioritizer-v1';
  var tasks = [];
  var seq = 1;

  var Q = {
    koupe: {
      label: 'Přivede mě to k člověku, který může koupit?',
      opts: [['ano', 'Ano, přímo'], ['neprimo', 'Nepřímo'], ['ne', 'Ne']]
    },
    cas: {
      label: 'Jak dlouho to zabere?',
      opts: [['kratky', 'Do 30 minut'], ['stredni', 'Pár hodin'], ['dlouhy', 'Den a víc']]
    },
    tyden: {
      label: 'Musí to být tenhle týden?',
      opts: [['ano', 'Ano'], ['ne', 'Ne']]
    },
    emoce: {
      label: 'Jak moc se ti do toho chce?',
      opts: [
        ['nechce', 'Nechce se mi', '😖'],
        ['ok',     'Nevadí mi to', '😐'],
        ['chce',   'Těším se',     '😃']
      ]
    }
  };

  var SCORE = {
    koupe: { ano: 10, neprimo: 4, ne: 0 },
    cas: { kratky: 3, stredni: 1, dlouhy: -1 },
    tyden: { ano: 3, ne: 0 }
  };

  function el(id) { return document.getElementById(id); }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        t: tasks, s: seq, c: (el('cil') ? el('cil').value : '')
      }));
    } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.t)) { tasks = d.t; seq = d.s || tasks.length + 1; }
      if (d && typeof d.c === 'string' && el('cil')) { el('cil').value = d.c; }
    } catch (e) {}
  }

  function add(name) {
    name = (name || '').trim();
    if (!name) return;
    if (name.length > 120) name = name.slice(0, 120);
    tasks.push({ id: seq++, name: name, koupe: null, cas: 'stredni', tyden: 'ne', emoce: 'ok' });
    save();
    render();
  }

  function remove(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    save();
    render();
  }

  function set(id, key, val) {
    var t = tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    t[key] = val;
    save();
    render();
  }

  // Pořadí se schválně počítá JEN z peněz a času. To, jestli se ti do něčeho
  // chce, pořadím nehybe — jinak by se nahoru dostávalo to příjemné.
  // Emoce se promitne do rady u úkolu a do závěru.
  function score(t) {
    return SCORE.koupe[t.koupe == null ? 'ne' : t.koupe]
      + SCORE.cas[t.cas]
      + SCORE.tyden[t.tyden];
  }

  function emoce(t) {
    return t.emoce || 'ok';
  }

  function label(t) {
    if (t.koupe === 'ano') return 'V';
    if (t.koupe === 'neprimo') return 'P';
    return 'X';
  }

  function why(t) {
    var l = label(t);
    var bits = [];
    if (l === 'V') {
      bits.push('Vede rovnou k člověku, který může koupit.');
      if (t.cas === 'kratky') bits.push('A je to za půl hodiny z krku — tohle dělej hned ráno.');
      else if (t.cas === 'dlouhy') bits.push('Zabere to ale celý den. Zkus z toho uříznout menší kus, který stihneš dnes.');
    } else if (l === 'P') {
      bits.push('Samo o sobě to nevydělá, ale bez toho by to nešlo.');
      if (t.cas === 'dlouhy') bits.push('Na celý den práce je to drahé. Dá se to zkrátit, nebo předat?');
      else bits.push('Nech si to na čas, kdy už nemáš energii oslovovat.');
    } else {
      bits.push('Nikoho ti to nepřivede.');
      if (t.tyden === 'ano') bits.push('Když to opravdu musí být, udělej to rychle a bez ladění.');
      else bits.push('Tenhle týden to klidně vynech. Nikdo si toho nevšimne.');
    }

    var e = emoce(t);
    if (l === 'V' && e === 'nechce') {
      bits.push('A nechce se ti do toho. Přesně tohle se odkládá nejčastěji — udělej to jako první věc ráno, dřív než si najdeš něco jiného.');
    } else if (l === 'V' && e === 'chce') {
      bits.push('A ještě se na to těšíš. Tak s tím začni.');
    } else if (l === 'P' && e === 'nechce') {
      bits.push('A nechce se ti do toho. U téhle kategorie je to signal, že by to za tebe mohl udělat někdo jiný.');
    } else if (l === 'X' && e === 'chce') {
      bits.push('A ještě se na to těšíš. To je ta nejzrádnější kombinace — příjemné a nikam nevedoucí.');
    }

    return bits.join(' ');
  }

  function render() {
    var box = el('list');
    if (!tasks.length) {
      box.textContent = '';
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Zatím tu nic není. Přidej první úkol nahoře.';
      box.appendChild(e);
      el('go').disabled = true;
      el('go').textContent = 'Seřadit podle toho, co vydělává';
      return;
    }

    box.textContent = '';
    tasks.forEach(function (t) {
      var wrap = document.createElement('div');
      wrap.className = 'task';

      var head = document.createElement('div');
      head.className = 'tname';
      var b = document.createElement('b');
      b.textContent = t.name;
      var del = document.createElement('button');
      del.className = 'del';
      del.title = 'Smazat';
      del.setAttribute('data-del', t.id);
      del.innerHTML = '&times;';
      head.appendChild(b);
      head.appendChild(del);
      wrap.appendChild(head);

      Object.keys(Q).forEach(function (k) {
        var q = document.createElement('div');
        q.className = 'q';
        var lab = document.createElement('div');
        lab.className = 'qlab';
        lab.textContent = Q[k].label;
        var opts = document.createElement('div');
        opts.className = 'opts';
        Q[k].opts.forEach(function (o) {
          var btn = document.createElement('button');
          btn.className = 'opt' + (t[k] === o[0] ? ' on' : '');
          btn.setAttribute('data-id', t.id);
          btn.setAttribute('data-k', k);
          btn.setAttribute('data-v', o[0]);
          if (o[2]) {
            var em = document.createElement('span');
            em.className = 'em';
            em.textContent = o[2];
            btn.appendChild(em);
            btn.appendChild(document.createTextNode(o[1]));
          } else {
            btn.textContent = o[1];
          }
          opts.appendChild(btn);
        });
        q.appendChild(lab);
        q.appendChild(opts);
        wrap.appendChild(q);
      });

      box.appendChild(wrap);
    });

    var ready = tasks.every(function (t) { return t.koupe !== null; });
    el('go').disabled = !ready;
    el('go').textContent = ready
      ? 'Seřadit podle toho, co vydělává'
      : 'Doplň u všech první otázku';
  }

  // Uvnitř rámu (na Wixu) nesmí odkaz mířit do nové záložky — rám to umí
  // zablokovat a tlačítko pak nedělá nic. Tam se naviguje celé okno.
  // Když nástroj běží sám o sobě, otevře se nová záložka jako dřív.
  var V_RAMU = (function () {
    try { return window.top !== window.self; } catch (e) { return true; }
  })();

  function radekCeny(c, tridy) {
    var r = document.createElement('div');
    r.className = 'radek' + (tridy ? ' ' + tridy : '');

    var co = document.createElement('span');
    co.className = 'co';
    co.textContent = c.popis;
    if (c.pozn) {
      var em = document.createElement('em');
      em.textContent = c.pozn;
      co.appendChild(em);
    }

    var kc = document.createElement('span');
    kc.className = 'kc';
    kc.textContent = c.kc;

    r.appendChild(co);
    r.appendChild(kc);
    return r;
  }

  function nabidka(counts) {
    var box = el('cta');
    var t, p;

    if (!counts.V) {
      t = 'Tohle je přesně ta chvíle, kdy se vyplatí si o tom promluvit';
      p = 'Ani jeden úkol tě nepostaví před člověka, který by ti mohl zaplatit. '
        + 'Není to o tom, že bys málo pracovala — jen ten týden nemá kudy vydělat. '
        + 'Na konzultaci si projdeme, čím ho naplnit.';
    } else if (counts.X > counts.V) {
      t = 'Vaty je víc než práce, která vydělává';
      p = 'Většinou to není o lenosti, ale o tom, že se člověk schová do věcí, '
        + 'které vypadají jako práce. Na konzultaci najdeme, kde ti ten čas utíká.';
    } else {
      t = 'Chceš to posunout rychleji?';
      p = 'Tenhle týden máš srovnaný. Když chceš zabrat víc — nastavit si nabídku, '
        + 'ceny a způsob, jak prodáváš — pojďme si o tom promluvit.';
    }

    el('ctaTitle').textContent = t;
    el('ctaText').textContent = p;
    el('ctaLink').target = V_RAMU ? '_top' : '_blank';

    var ceny = el('ctaCeny');
    ceny.textContent = '';

    if (JE_CLEN) {
      el('ctaClen').textContent =
        'Běžně se ke mně klienti objednávají na konzultaci za 5 000 Kč za hodinu a půl. '
        + 'Ty můžeš jako člen téhle komunity využít třicetiminutovou konzultaci, '
        + 'kde jdeme rovnou k jádru problému. Tuhle nabídku nenajdeš nikde jinde — '
        + 'ani těch třicet minut, ani tuhle cenu nemá k dispozici nikdo jiný než členové komunity.';
      el('ctaClen').style.display = 'block';

      ceny.appendChild(radekCeny(CENA.bezny, 'skrtnuto'));
      ceny.appendChild(radekCeny(CENA.clen, 'hlavni'));

      el('ctaLink').textContent = 'Rezervovat členskou konzultaci';
      el('ctaLink').href = ODKAZ_CLEN;
      el('ctaPozn').textContent =
        'Je to třicet minut, proto jdeme rovnou k věci — přijď s jednou konkrétní otázkou. '
        + 'Nejdřív se platí, pak si v kalendáři vybereš čas. '
        + 'Členská cena platí, dokud jsi v komunitě.';
    } else {
      el('ctaClen').textContent = '';
      el('ctaClen').style.display = 'none';

      // Veřejně je to jediná cena, tak u ní nemá smysl psát „běžná cena“.
      ceny.appendChild(radekCeny({ popis: CENA.bezny.popis, pozn: '', kc: CENA.bezny.kc }, 'hlavni'));

      el('ctaLink').textContent = 'Chci konzultaci';
      el('ctaLink').href = ODKAZ_BEZNY;
      el('ctaPozn').textContent =
        'Nejdřív se platí, pak si v kalendáři vybereš čas, který ti vyhovuje.';
    }

    box.style.display = 'block';
  }

  function cil() {
    var v = (el('cil') && el('cil').value || '').trim();
    return v.length > 120 ? v.slice(0, 120) : v;
  }

  function run() {
    var c = cil();
    var box = el('cilOut');
    if (c) {
      box.textContent = 'Tenhle týden chceš, aby se povedlo: ';
      var b = document.createElement('b');
      b.textContent = c;
      box.appendChild(b);
      box.style.display = 'block';
    } else {
      box.textContent = '';
      box.style.display = 'none';
    }

    var sorted = tasks.slice().sort(function (a, b) { return score(b) - score(a); });
    var counts = { V: 0, P: 0, X: 0 };
    sorted.forEach(function (t) { counts[label(t)]++; });

    var res = el('res');
    res.textContent = '';
    sorted.forEach(function (t, i) {
      var l = label(t);
      var row = document.createElement('div');
      row.className = 'res';

      var rank = document.createElement('div');
      rank.className = 'rank';
      rank.textContent = (i + 1) + '.';

      var body = document.createElement('div');
      body.className = 'rbody';

      var top = document.createElement('div');
      top.className = 'rtop';
      var nm = document.createElement('span');
      nm.className = 'rname';
      nm.textContent = t.name;
      var bd = document.createElement('span');
      bd.className = 'badge b-' + l;
      bd.textContent = l === 'V' ? 'Vydělávající' : (l === 'P' ? 'Podpůrné' : 'Vata');
      top.appendChild(nm);
      top.appendChild(bd);

      var w = document.createElement('div');
      w.className = 'rwhy';
      w.textContent = why(t);

      body.appendChild(top);
      body.appendChild(w);
      row.appendChild(rank);
      row.appendChild(body);
      res.appendChild(row);
    });

    el('sV').textContent = counts.V;
    el('sP').textContent = counts.P;
    el('sX').textContent = counts.X;

    var v;
    if (!counts.V) {
      v = 'Ani jeden z těch úkolů tě nepostaví před člověka, který by ti mohl zaplatit. '
        + 'Tohle je přesně ten týden, po kterém budeš unavená a na účtu se nic nezmění. '
        + 'Dopiš si sem jednu věc, která tě k někomu dostane.';
    } else if (counts.X > counts.V) {
      v = 'Vydělávající úkoly máš ' + counts.V + ', vaty je ' + counts.X + '. '
        + 'Začni prvním v pořadí a aspoň jednu věc z konce dnes škrtni.';
    } else {
      v = 'Začni prvním v pořadí a nepouštěj se do ničeho dalšího, dokud ho nemáš hotový.';
    }
    var vNechce = sorted.filter(function (t) {
      return label(t) === 'V' && emoce(t) === 'nechce';
    }).length;
    if (vNechce === 1) {
      v += ' Jeden z vydělávajících úkolů se ti dělat nechce. To není náhoda — peníze bývají schované přesně za tím, co odkládáš.';
    } else if (vNechce > 1) {
      v += ' Hned u ' + vNechce + ' vydělávajících úkolů se ti do toho nechce. To není náhoda — peníze bývají schované přesně za tím, co odkládáš.';
    }

    // Cíl se neopakuje — je vidět nad výsledkem. Opře se o něj jen tam,
    // kde to něco řekne: když týden k němu nevede.
    if (c && !counts.V) {
      v += ' Na „' + c + '“ se takhle nedostaneš.';
    } else if (c && counts.X > counts.V) {
      v += ' Na „' + c + '“ ti takhle nezbude čas.';
    }

    el('verdict').textContent = v;

    nabidka(counts);

    el('out').style.display = 'block';
    el('out').scrollIntoView({ behavior: 'smooth', block: 'start' });

    askAI(sorted);
  }

  // Volitelné: když vedle leží api.php s klíčem, připojí se rozbor od modelu.
  // Když tam není, nestane se nic a nástroj funguje dál.
  function askAI(sorted) {
    var box = el('ai');
    box.style.display = 'none';

    var payload = sorted.map(function (t) {
      return { ukol: t.name, typ: label(t), koupe: t.koupe, cas: t.cas, tyden: t.tyden };
    });

    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctl) setTimeout(function () { ctl.abort(); }, 25000);

    el('aitxt').textContent = '';
    var spin = document.createElement('div');
    spin.className = 'spin';
    spin.textContent = 'Čtu to…';
    el('aitxt').appendChild(spin);
    box.style.display = 'block';

    fetch('api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ukoly: payload, cil: cil() }),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('nedostupne');
      return r.json();
    }).then(function (d) {
      if (d && d.text) {
        el('aitxt').textContent = d.text;
      } else {
        box.style.display = 'none';
      }
    }).catch(function () {
      box.style.display = 'none';
    });
  }

  el('add').addEventListener('click', function () {
    add(el('inp').value);
    el('inp').value = '';
    el('inp').focus();
  });

  el('inp').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      add(el('inp').value);
      el('inp').value = '';
    }
  });

  el('list').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    if (b.getAttribute('data-del')) {
      remove(parseInt(b.getAttribute('data-del'), 10));
    } else if (b.getAttribute('data-id')) {
      set(parseInt(b.getAttribute('data-id'), 10), b.getAttribute('data-k'), b.getAttribute('data-v'));
    }
  });

  el('go').addEventListener('click', run);

  el('again').addEventListener('click', function () {
    tasks = [];
    seq = 1;
    if (el('cil')) { el('cil').value = ''; }
    el('cilOut').style.display = 'none';
    save();
    el('out').style.display = 'none';
    el('cta').style.display = 'none';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  if (!otevreno()) {
    zavri();
  } else {
    load();
    render();
  }
})();
