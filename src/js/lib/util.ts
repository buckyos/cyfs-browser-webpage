import * as cyfs from '../../cyfs_sdk/cyfs'
import { toast } from './toast.min'
import $ from 'jquery';
import { zh } from './i18n/zh'
import { en } from './i18n/en'

class NONObject {
  m_sharedStatck: cyfs.SharedCyfsStack;
  m_router: cyfs.NONRequestor;
  m_util_service: cyfs.UtilRequestor;

  constructor() {
    this.m_sharedStatck = cyfs.SharedCyfsStack.open_runtime();
    this.m_router = this.m_sharedStatck.non_service();
    this.m_util_service = this.m_sharedStatck.util();
  }

  async getObject(params: {
    id: cyfs.ObjectId | string,
    decoder?: cyfs.ObjectIdDecoder,
    flags?: number,
    target?: cyfs.ObjectId,
    inner_path?: string,
    req_path?: string,
    dec_id?: cyfs.ObjectId,
    isReturnResult?: boolean
  }) {
    console.log('-------------get_object-params', params, typeof (params.id))
    let object_id: cyfs.ObjectId;
    if (typeof (params.id) == 'string') {
      let idResult = cyfs.ObjectId.from_base_58(params.id);
      if (idResult.err) {
        toast({
          message: "Id格式不对",
          time: 1500,
          type: 'warn'
        });
        return
      } else {
        object_id = idResult.unwrap()
      }
    } else {
      object_id = params.id;
    }
    let target = params.target ? params.target : undefined;
    let flags = params.flags ? params.flags : 0;
    let req: cyfs.NONGetObjectOutputRequest = {
      object_id: object_id,
      inner_path: params.inner_path,
      common: {
        level: cyfs.NONAPILevel.Router,
        flags: flags,
        target: target,
        req_path: params.req_path,
        dec_id: params.dec_id
      }
    }
    console.log('-----------------req', req)
    const r = await this.m_router.get_object(req);
    console.log('-----------------r', r)
    if (r.err) {
      return r;
    } else {
      let resp = r.unwrap();
      if (params.isReturnResult) {
        return resp;
      } else {
        let respCode = params.decoder?.raw_decode(resp.object.object_raw);
        if (respCode) {
          return respCode.unwrap();
        }
      }
    }
  }

  async postObj(obj:cyfs.DecApp|cyfs.AppCmd|cyfs.AppExtInfo) {
    const router = this.m_router;
    let buf_len = obj.raw_measure().unwrap();
    let buf = new Uint8Array(buf_len);
    obj.raw_encode(buf);
    let r = await router.post_object({
      object: new cyfs.NONObjectInfo(obj.desc().calculate_id(), buf),
      common: {
        level: cyfs.NONAPILevel.Router,
        flags: 0
      }
    });
    console.origin.log('--------postObj-r', r)
    if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
      return r;
    } else {
      return r;
    }
  }

  async putObj(obj:cyfs.DecApp|cyfs.AppCmd|cyfs.AppExtInfo) {
    const router = this.m_router;
    let buf_len = obj.raw_measure().unwrap();
    let buf = new Uint8Array(buf_len);
    obj.raw_encode(buf);
    let r = await router.put_object({
      object: new cyfs.NONObjectInfo(obj.desc().calculate_id(), buf),
      common: {
        level: cyfs.NONAPILevel.Router,
        flags: 0
      }
    });
    console.origin.log('--------putObj-r', r)
    if (r.err && r.val.code != cyfs.BuckyErrorCode.Ignored) {
      return r;
    } else {
      return r;
    }
  }

  async objectIdFormat(id:string | cyfs.ObjectId) {
    let obj_id: cyfs.ObjectId;
    if (typeof (id) == 'string') {
        let idRet = cyfs.ObjectId.from_base_58(id);
        console.log('idRet', idRet)
        if (idRet.err) {
            toast({
            message: LANGUAGESTYPE == 'zh'? 'id格式错误': 'id error',
            time: 1500, 
            type: 'warn'
            });
            return;
        } else {
          obj_id = idRet.unwrap();
        }
    }else{
      obj_id = id;
    }
    return obj_id;
  }

  async getOodStatus(id?:cyfs.ObjectId) {
    // ood status
    let req = id ? { common: { flags: 0, target: id } } : { common: { flags: 0 } };
    let ood_status = await this.m_util_service.get_ood_status(req);
    if (!ood_status.err) {
        ood_status = ood_status.unwrap().status;
        console.log('ood_status:', ood_status);
        if (ood_status.last_ping_result == 0) {
            // online
            return true;
        } else {
            // off-line
            return false;
        }
    }else{
        return false;
    }
  }

  async getHeaderInfo() {
    // Device static info
    let current_device_static_info = await this.m_util_service.get_device_static_info({ common: { flags: 0 } });
    if (!current_device_static_info.err) {
        current_device_static_info = current_device_static_info.unwrap().info;
    }
    console.info('current_device_static_info:', current_device_static_info);
    let oodStatusIcon:string = '../img/browser_main_ood_offline.svg';
    let peopleName:string = '';
    let peoplePicture:string = '';
    if (current_device_static_info.owner_id) {
        const peopleR = (await ObjectUtil.getObject({ id: current_device_static_info.owner_id, isReturnResult: true, flags: 1 })).object;
        console.origin.log('peopleR:', peopleR);
        let oodList = peopleR.object.body().unwrap().content().ood_list;
        if (oodList[0]) {
            let mainStatus: boolean = await this.getOodStatus();
            console.log('--mainStatus', mainStatus)
            if(oodList.length == 1){
                if(mainStatus){
                    oodStatusIcon = '../img/browser_main_ood_online.svg';
                }else{
                    oodStatusIcon = '../img/browser_main_ood_offline.svg';
                }
            }else{
                let minerStatus: boolean = true;
                let currentStatus: boolean = true;
                for (let index = 0; index < oodList.length; index++) {
                    const ood = oodList[index];
                    if(currentStatus && index > 0){
                        currentStatus = await this.getOodStatus(ood.object_id);
                        if(!currentStatus){
                            console.log('--oodList[index].object_id-minerStatus', index, ood.object_id)
                            minerStatus = false;
                        }
                    }
                }
                console.log('--minerStatus', mainStatus)
                if(mainStatus && minerStatus){
                    oodStatusIcon = '../img/browser_ood_online_online.svg';
                }else if(mainStatus && !minerStatus){
                    oodStatusIcon = '../img/browser_ood_online_offline.svg';
                }else if(!mainStatus){
                    oodStatusIcon = '../img/browser_ood_offline_offline.svg';
                }
            }
        }
        peopleName = peopleR.object.name() ? peopleR.object.name() : (LANGUAGESTYPE == 'zh'? '未设置名称':'name not set');
        if(peopleR.object.icon()){
            peoplePicture = 'cyfs://o/'+peopleR.object.icon().object_id;
        }else{
            peoplePicture = '../img/browser_people_icon.svg';
        }
    }
    return {
      oodStatusIcon: oodStatusIcon,
      peopleName: peopleName,
      peoplePicture: peoplePicture
    }
    
  }

  async renderHeaderInfo() {
    let headerInfo = await this.getHeaderInfo();
    $('.util_header_right').html(`<img class="ood_status" src="${headerInfo.oodStatusIcon}" alt=""><img class="people_head_sculpture" src="${headerInfo.peoplePicture}" alt="" onerror="this.src='../img/browser_people_icon.svg';this.οnerrοr=null"><span class="people_name">${headerInfo.peopleName}</span>`);
  }
}

export const ObjectUtil = new NONObject;

// 时间格式转换
export function formatDate(date: number | string | Date, isfoleder?: boolean) {
  if (Number(date) > 0) {
    date = new Date(Number(date))
    var years = date.getFullYear() > 9 ? date.getFullYear() : '0' + date.getFullYear();
    var months = (date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (date.getMonth() + 1);
    var dates = date.getDate() > 9 ? date.getDate() : '0' + date.getDate();
    var hours = date.getHours() > 9 ? date.getHours() : '0' + date.getHours();
    var minutes = date.getMinutes() > 9 ? date.getMinutes() : '0' + date.getMinutes();
    var seconds = date.getSeconds() > 9 ? date.getSeconds() : '0' + date.getSeconds();
    if (isfoleder) {
      return years + '-' + months + '-' + dates + '<br/>' + hours + ':' + minutes + ':' + seconds;
    } else {
      return years + '-' + months + '-' + dates + ' ' + hours + ':' + minutes + ':' + seconds;
    }
  } else {
    return '-';
  }
}

//截取字符串中间用省略号显示
export function getSubStr(str: string | undefined | cyfs.ObjectId, beforeLength?: number, afterLength?: number) {
  if (str) {
    str = str?.toString();
    let beforeNumber = beforeLength ? beforeLength : 10;
    let afterNumber = afterLength ? afterLength : 5;
    var subStr1: string = str.length > beforeNumber ? str.substr(0, beforeNumber) : str.substr(0, str.length);
    var subStr2: string = str.length > beforeNumber + afterNumber ? '...' + str.substr(str.length - afterNumber, afterNumber) : '...';
    return subStr1 + subStr2;
  } else {
    return '';
  }
}

// 获取账户登陆状态
export async function getStatus(){
  $.ajax({
    url: 'http://127.0.0.1:38090/status',
    success:function(result){
      console.log('getStatus-result', result);
      if(result.anonymous || !result.is_bind){
      }else{
      }
    }
  });
}

// 判断是pc还是移动端
export function hasPC() {
  var userAgentInfo = navigator.userAgent;
  let ISPC = true;
  var Agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
  for (var v = 0; v < Agents.length; v++) {
    if (userAgentInfo.indexOf(Agents[v]) > 0) {
      ISPC = false;
    }
  }
  return ISPC;
}

// copy data
export function copyData (data:string) {
  $('#copy_textarea').text(data).show();
  $('#copy_textarea').select();
  document.execCommand('copy', false, '');
  $('#copy_textarea').hide();
  toast({
      message: LANGUAGESTYPE == 'zh'?"复制成功":'Copied successfully',
      time: 1500,
      type: 'success'
  });
}

//ecc转换
export function castToLocalUnit(value: number | null | undefined) {
  if (value) {
    let tmp = BigInt(BigInt(value) / BigInt(1000));
    let num = ((Number(tmp.toString())) / 100000)
    num = Math.round(num * Math.pow(10, 4)) / Math.pow(10, 4);
    return num.toString();
  } else {
    return '0';
  }
}
// 当前语言
export let LANGUAGESTYPE:string = 'en';
export let LANGUAGESOBJECT = en;

export async function setLanguages (languages: string){
  $('[set-lan]').each(function () {
    let _this = $(this);
    let setLanContent = _this.attr('set-lan')!.split(':');
    let domKey = setLanContent[0];
    let keyName:string = setLanContent[1];
    let lan = en;
    if(languages == 'zh'){
      LANGUAGESOBJECT = lan = zh;
      LANGUAGESTYPE = 'zh';
    }else{
      lan = LANGUAGESOBJECT = en;
      LANGUAGESTYPE = 'en';
    }
    let showContent:string = '';
    if(keyName.indexOf('.') > -1){
      const keys = keyName.split('.');
      const firstKey:string = keys[0];
      const secondKey:string = keys[1];
      showContent = lan[firstKey][secondKey];
    }else{
      showContent = lan[keyName];
    }
    switch (domKey) {
      case 'html':
        _this.html(showContent); 
        break;
      case 'val':
      case 'value':
        _this.val(showContent);
        break;
      case 'src':
        _this.attr('src',showContent); 
        break;
      case 'placeholder':
        _this.attr('placeholder',showContent); 
        break;
      default:
        _this.html(showContent);
    }
  });
}

$(function(){
  var browerLanguage =(navigator.languages[0] || navigator.browserLanguage).toLowerCase();
  console.log('browerLanguage', browerLanguage)
  if(browerLanguage.indexOf('zh')!=-1){
    setLanguages('zh');
  }else{
    setLanguages('en');
  }
});

export const STATUSTYPE:{'zh':string,'en':string}[] = [
  {
    'zh': '成功',
    'en': 'Succeeded'
  },
  {
    'zh': '失败',
    'en': 'Failed'
  },
]

export const TXTYPES:{'zh':string,'en':string}[] = [
  {
    'zh': '转账',
    'en': 'Transfer'
  },
  {
    'zh': '提现',
    'en': 'Withdraw'
  },
]

export function lenghtstr(str:string){
  var realLength = 0, len = str.length, charCode = -1;
  for (var i = 0; i < len; i++) {
      charCode = str.charCodeAt(i);
      if (charCode >= 0 && charCode <= 128)
          realLength += 1;
      else
          realLength += 2;
  }
  return realLength;
}
