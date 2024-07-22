var axios = require('axios');

function getUser(id,udb){
    return udb.doc(id.toString()).get().then(u=>{
        let t = u.data()
            t.id = u.id;
        return t
    }).catch(err=>{})
}
function sendMessage2(m, ep, channel, messages, extra) {
    
    return axios.post('https://api.telegram.org/bot' + channel + '/' + (ep ? ep : 'sendMessage'), m, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(telres => {
        
        if(messages && telres.data.ok){

            let toLog =  {
                createdAt:  new Date(),
                user:       +m.chat_id,
                text:       m.text || m.caption || null,
                isReply:    true,
                photo:      m.photo || null,
                messageId:  telres.data.result.message_id
            }

            if(extra) Object.keys(extra).forEach(f=>toLog[f]=extra[f])

            devlog(toLog)
            
            // ЗДЕСЬ ДОЛЖНО БЫТЬ ЛОГИРОВАНИЕ СООБЩЕНИЕ И ОБРАТНАЯ СВЯЗЬ АДМИНАМ
            
            // messages.add(toLog).then(()=>devlog(`logged ${(toLog.text || '').slice(0,10)} to ${toLog.user}`)).catch(err=>{
            //     alertMe({
            //         text: `Ошибка логирования: ${err.message}`
            //     })
            // })
        }
        
        return telres.data;
        
    }).catch(err => {
        console.log(err)
        return false
        
        // res.sendStatus(500);
        // throw new Error(err);
    })
}


module.exports = {getUser,sendMessage2};

