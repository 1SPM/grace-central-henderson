(() => {
  const names = ['Groceries','Fuel & transport','Dining & coffee','Shopping & household','Other everyday spending'];
  const form = document.querySelector('#spending');
  const money = value => '$' + value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const rows = names.map((name,i) => {
    const row = document.createElement('div'); row.className='spend-row';
    row.innerHTML = `<label for="amount-${i}">${name}</label><input id="amount-${i}" type="number" min="0" max="100000" step="1" value="0" required aria-label="${name}, monthly dollars"><input type="range" min="0" max="5000" step="50" value="0" aria-label="${name}, monthly spending slider">`;
    document.querySelector('#categories').append(row);
    const number=row.querySelector('input'),range=row.querySelector('[type=range]');
    range.addEventListener('input',()=>{number.value=range.value;update();});
    number.addEventListener('input',()=>{range.value=Math.min(5000,Number(number.value));});
    return number;
  });
  function update(){
    const valid=[...form.querySelectorAll('input')].every(input=>input.validity.valid);
    document.querySelector('#error').textContent=valid?'':'Enter valid, nonnegative estimates and rates within the displayed input limits.';
    document.querySelector('#cause-name').textContent=form.querySelector('#cause').value;
    if(!valid){document.querySelector('#monthly').textContent='—';document.querySelector('#yearly').textContent='—';document.querySelector('#breakdown').replaceChildren();document.querySelector('#formula').textContent='Check the inputs to calculate your estimate.';return;}
    const amounts=rows.map(input=>Number(input.value)),total=amounts.reduce((a,b)=>a+b,0),eligible=Number(form.querySelector('#eligible').value)/100,rate=Number(form.querySelector('#rate').value)/100;
    const monthly=total*eligible*rate;
    document.querySelector('#monthly').textContent=money(monthly);document.querySelector('#yearly').textContent=money(monthly*12);
    document.querySelector('#breakdown').replaceChildren(...names.map((name,i)=>{const row=document.createElement('div');row.className='break-row';const label=document.createElement('span'),value=document.createElement('strong');label.textContent=name;value.textContent=money(amounts[i]*eligible*rate);row.append(label,value);return row;}));
    document.querySelector('#formula').textContent=`${money(total)} monthly spending × ${eligible*100}% eligible × ${Number(form.querySelector('#rate').value)}% sample rate = ${money(monthly)}. Category values are rounded for display; totals use unrounded amounts.`;
  }
  form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',update);form.addEventListener('reset',()=>setTimeout(update,0));update();
})();
