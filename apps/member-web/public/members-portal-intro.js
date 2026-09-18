/* Reuse GRACE's own icon artwork; decoration never replaces the text label. */
(() => {
  const example=document.querySelector('.guide-example');if(!example)return;
  const guides=[
    ['My Church','Your church, at a glance','home','Services, people, and ways to take part.',['Follow the message','Find your people','Take part your way'],'Your church connections, participation, interests, and next steps.'],
    ['My Leadership','How your church can support you','prayer','Meet your leaders, explore teachings, and find personal support.',['Meet your leaders','Explore a teaching','Find human support'],'The guidance you are looking for and the support you would like to explore. AI avatars are not live pastors.'],
    ['Wallet','Get to know your card','card','How the card works, what to expect, and getting ready to apply.',['Understand the possibilities','Know what you’re choosing','Take the next step when ready'],'Questions, concerns, and what would help you decide. This is not a card application.'],
    ['IMPACT','See what your spending could support','dollar','See how everyday purchases could support a cause you care about.',['Explore your everyday spending','Choose a cause','See an illustrative estimate'],'Your spending categories, rough monthly estimates, and the causes you care about. Sample rates are not confirmed benefits.'],
    ['Connect','Find your people','groups','Groups, events, and ways to build connections in your church.',['Find your people','Make room for something new','Stay in the conversation'],'Where you already feel connected, what you would enjoy exploring, and how you would like to begin.'],
    ['Reflect','Bring the message into your week','bible','Reflect on the message and make room for your own thoughts.',['Return to the message','Make room for reflection','Consider your next step'],'What stood out to you, your questions, and how the message connects with your week.']
  ];
  const list=document.createElement('div');list.className='workshop-guides';list.setAttribute('aria-label','Explore each page guide');
  guides.forEach(([page,title,icon,subline,sections,topics])=>{
    const details=document.createElement('details');details.className='workshop-guide';
    const summary=document.createElement('summary');
    const mark=document.createElement('span');mark.className='intro-icon intro-icon-small';mark.setAttribute('aria-hidden','true');if(typeof graceIcon==='function')mark.innerHTML=graceIcon(icon,{size:22});
    const text=document.createElement('span');const category=document.createElement('small');category.textContent=page;const heading=document.createElement('strong');heading.textContent=title;const sub=document.createElement('span');sub.className='guide-subline';sub.textContent=subline;text.append(category,heading,sub);summary.append(mark,text);
    const body=document.createElement('div');body.className='workshop-guide-body';const ul=document.createElement('ul');sections.forEach(section=>{const li=document.createElement('li');li.textContent=section;ul.append(li);});
    const h=document.createElement('h3');h.textContent='Let us know';const p=document.createElement('p');p.textContent=topics;const note=document.createElement('p');note.className='note';note.textContent='Guide preview. Open the desktop or mobile workshop below to share your answers.';body.append(ul,h,p,note);details.append(summary,body);list.append(details);
  });example.replaceWith(list);
  document.querySelector('#workshop .topics')?.remove();
})();
(() => {
  const art=document.querySelector('.card-art'),img=art?.querySelector('img');
  if(!img)return;
  const button=document.createElement('button');button.type='button';button.className='intro-card-flip';button.setAttribute('aria-label','Show IMPACT card back');button.setAttribute('aria-pressed','false');
  const inner=document.createElement('span');inner.className='intro-card-inner';
  const front=document.createElement('span');front.className='intro-card-face intro-card-front';front.append(img);
  const back=document.createElement('span');back.className='intro-card-face intro-card-back';back.setAttribute('aria-hidden','true');back.innerHTML='<img src="assets/faithful-church-logo-wht.png" alt="Faithful Church"><span class="intro-card-stripe"></span><span class="intro-card-signature">CVV (demo) •••</span><small>Faithful Church · Powered by GRACE<br>Illustrative card only</small>';
  inner.append(front,back);button.append(inner);art.append(button);
  button.addEventListener('click',()=>{const flipped=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(flipped));button.setAttribute('aria-label',flipped?'Show IMPACT card front':'Show IMPACT card back');front.setAttribute('aria-hidden',String(flipped));back.setAttribute('aria-hidden',String(!flipped));});
  const copy=document.querySelector('.impact>div:last-child');
  copy.querySelectorAll('p')[1].textContent='Estimate your monthly spending and explore the assumptions behind the potential support for your chosen cause.';
  const link=document.createElement('a');link.className='button navy';link.href='impact-calculator.html';link.textContent='Estimate your IMPACT';copy.append(link);
})();
(() => {
  if (typeof graceIcon !== 'function') return;
  function icon(name, small = false) {
    const el = document.createElement('span');
    el.className = 'intro-icon' + (small ? ' intro-icon-small' : '');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = graceIcon(name, { size: small ? 20 : 28 });
    return el;
  }
  [['#watch h2','watch'],['#explore h2','home'],['.impact h2','card'],['#workshop h2','journal']].forEach(([selector,name]) => document.querySelector(selector)?.before(icon(name)));
  // Keep markers with their headings in the two-column section headers.
  document.querySelectorAll('.section-head > .intro-icon').forEach(mark => {
    const heading = mark.nextElementSibling;
    const group = document.createElement('div'); mark.before(group); group.append(mark, heading);
  });
  document.querySelectorAll('.path b').forEach((el,i) => el.prepend(icon(['watch','home','journal'][i], true)));
  document.querySelectorAll('.topics dt').forEach((el,i) => el.prepend(icon(['home','prayer','card','groups','bible'][i], true)));
  document.querySelector('.example-head > span')?.replaceWith(icon('home',true));
  const drawings = [
    '<rect x="3" y="4" width="26" height="18" rx="2"/><path d="M12 28h8M16 22v6"/>',
    '<rect x="8" y="2" width="16" height="28" rx="3"/><path d="M13 6h6M15 26h2"/>'
  ];
  document.querySelectorAll('.device-symbol').forEach((el,i) => { el.innerHTML = '<svg viewBox="0 0 32 32" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">'+drawings[i]+'</svg>'; });
})();
