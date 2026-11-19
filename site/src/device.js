/* Procedural CSS 3D casing; the screen stays live HTML from the source-derived views. */
window.WinnowDevice = {
  enhance(phone) {
    if (!phone || phone.querySelector('.device-slice')) return;
    for (let i=18;i>=0;i--) {
      const slice=document.createElement('i');slice.className='device-slice';
      slice.style.setProperty('--slice',i);slice.setAttribute('aria-hidden','true');phone.prepend(slice);
    }
    ['power','volume-up','volume-down','antenna-top','antenna-bottom','glare'].forEach(name=>{
      const part=document.createElement('i');part.className='device-'+name;part.setAttribute('aria-hidden','true');phone.appendChild(part);
    });
  }
};
