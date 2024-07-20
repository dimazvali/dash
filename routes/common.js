function handleError(err,res){
    
    console.log(err)
    
    if(res) res.status(500).send(err.message)
    
    alertMe({
        text: `Ошибка! ${err.message}`
    })
}

function handleDoc(d){
    
    if(!d.exists) return false;

    let t = d.data();
        t.id = d.id;
    return t;
}

function handleQuery(col,byDate,byName){
    let res = col.docs.map(q => {
        let f = q.data();
        f.id = q.id
        return f
    })
    if(byDate){
        res = res.sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds)
    }
    if(byName){
        res = res.sort((a,b)=>sortableText(b.name) > sortableText(a.name) ? -1 : 0)
    }
    // devlog(res)
    return res
}

function devlog(v) {
    if (process.env.develop == 'true') {
        console.log(v)
    }
}

module.exports = {
    devlog,
    handleQuery,
    handleDoc,
    handleError
};

