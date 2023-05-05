import $ from 'jquery'
import * as cyfs from '../cyfs_sdk/cyfs'

let g_isBind:boolean = false;
class Util {
    m_sharedStatck: cyfs.SharedCyfsStack;
    m_util_service: cyfs.UtilRequestor;
    m_router: cyfs.NONRequestor;
    meta_client: cyfs.MetaClient;
    constructor() {
        this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime(cyfs.get_system_dec_app().object_id);
        this.m_util_service = this.m_sharedStatck.util();
        this.m_router = this.m_sharedStatck.non_service();
        // 空参数或'test'为测试链，传'dev'为正式链
        this.meta_client = cyfs.create_meta_client();
    }

    async txtToId (id: string) {
        let idResult = cyfs.ObjectId.from_base_58(id);
        console.origin.log('idResult', idResult)
        if (idResult.err) {
            return false;
        } else {
            return true;
        }
    }
}

const util = new Util();

function isUnbind() {
    $.ajax({
        url: 'http://127.0.0.1:38090/status',
        success:function(result){
            console.log('getStatus-result', result);
            if (result.anonymous) {
                g_isBind = false;
            }else{
                g_isBind = true;
            }
           
        }
    });
};
isUnbind();

// 搜索
async function searchTxt(value?:string) {
    let val = value ? value: String($('#unsignin_input')!.val()!).trim();
    if(val){
        if (g_isBind) {
            let isObject = await util.txtToId(val);
            if(isObject){
                window.open("cyfs://static/object_browser/objects.html?id=" + val);
            }else{
                chrome.search.query({text: val, disposition: 'NEW_TAB'});
            }
        }else{
            chrome.search.query({text: val, disposition: 'NEW_TAB'});
        }
    }
}

$('.browser-search-svg').on('click', (event) => {
    searchTxt()
})

$('#unsignin_input').on('keydown', (event) => {
    if (event.keyCode == 13) { searchTxt() }
})

$('.cyfs-icon').on('click', function () {
    window.location.href = 'https://www.cyfs.com/';
})
