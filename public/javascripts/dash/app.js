let tg = window.Telegram.WebApp;
const host = `dash`

axios.post(`/${host}/authRoom?room=${roomId}`,tg.initData)
    .then(s=>{
        window.location.href=`https://dishdash.f-dyakonov.ru?room=${s.data.room}&name=${s.data.name}&photo=${s.data.photo}` 
    })
    .catch(err=>{
        tg.showAlert(err.message)
    })
