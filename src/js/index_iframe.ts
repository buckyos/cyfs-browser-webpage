import * as cyfs from '../cyfs_sdk/cyfs'
import $ from 'jquery'

let g_ownerId = '';
let g_isAnonymous = false;
let g_environment = 'beta';

class Util {
    constructor() {
    }
    async txtToId (id: string) {
        try{
            let idResult = cyfs.ObjectId.from_base_58(id);
            console.origin.log('idResult', idResult)
            if (idResult.err) {
                return false;
            } else {
                return idResult.unwrap();
            }
        }catch{
            return false;
        }
    }

    async getPeopleInfo () {
        console.log('getPeopleInfo init')
        if(!g_ownerId){
            console.log('getPeopleInfo g_ownerId await')
            await getOwnerId();
            console.log('getPeopleInfo g_ownerId await finish')
        }
        console.log('getPeopleInfo g_ownerId', g_ownerId)
        if(g_ownerId){
            console.log('getPeopleInfo g_ownerId in', g_ownerId)
            let meta_client = cyfs.create_meta_client(g_environment);
            let owner = await this.txtToId(g_ownerId);
            console.origin.log('getPeopleInfo owner init', owner)
            if(owner){
                let getDescR = await meta_client.getDesc(owner);
                if(getDescR){
                    console.origin.log('getPeopleInfo getDescR init', getDescR)
                    let name = 'name not set';
                    if(!getDescR.err){
                        let people = getDescR.unwrap().people;
                        name = people.name();
                    }
                    // $('#people_name2').html(name);
                    // $('#user_switch').css({'background':'url(./img/browser_people_icon.svg) no-repeat center center','background-size': '100%'});
                    window.parent.postMessage({peopleName: name, peopleIcon: './img/browser_people_icon.svg'},'*');
                }
            }
        }
    }

}
const util = new Util();
async function getOwnerId(){
    $.ajax({
        url: 'http://127.0.0.1:1321/check',
        async: false,
        success:function(data){
            let result = JSON.parse(data);
            console.origin.log('getScanContent-check-result', result);
            g_ownerId = result.bind_info?result.bind_info.owner_id:'';
            console.origin.log('g_ownerId', g_ownerId);
        },error: function(err) {
            setTimeout(() => {
                getOwnerId();
            }, 300);
        }
    })
}

window.addEventListener('message', async function(e){
    console.origin.log("iframe get e.data", e.data)
    g_isAnonymous = e.data.isAnonymous;
    if(typeof(e.data.isAnonymous) == "undefined"){
        window.parent.postMessage({ pageAlready: true }, '*');
    }else if(e.data.isAnonymous == false){
        getOwnerId();
        util.getPeopleInfo();
    }
    if(e.data.searchVal){
        let val = e.data.searchVal;
        let id = await util.txtToId(val);
        window.parent.postMessage({searchIdRet: id, searchVal: val },'*');
    }
}, false);

window.parent.postMessage({ pageAlready: true }, '*');

