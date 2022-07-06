import * as cyfs from '../cyfs_sdk/cyfs'
const QRCode = require('qrcode')
import { hasPC } from './lib/util'


let ISPC = hasPC();
function getIsSignIn() {
    let isBindInterval: NodeJS.Timeout | null = null;
    let url = 'http://127.0.0.1:1321/check';
    let localIps = [];
    let ajax = new XMLHttpRequest();
    ajax.open('get', url, true);
    ajax.send();
    ajax.onreadystatechange = function () {
        if (ajax.readyState == 4 && ajax.status == 200) {
            const result = JSON.parse(ajax.responseText)
            if (!result.activation) {
                localIps = result.device_info.private_ip_address
                let params = {
                    "flag": "cyfs",
                    "type": "bindDevice",
                    "data": {
                        "type": 2,
                        "ip": localIps
                    }
                }
                QRCode.toCanvas(document.getElementById('scann_code_box_img'), JSON.stringify(params), {
                    errorCorrectionLevel: 'L',
                    width: 160,
                    height: 160,
                    margin: 0
                });
                isBindInterval = setInterval(() => {
                    getIsSignIn();
                }, 2000);
            } else {
                if (isBindInterval) {
                    clearInterval(isBindInterval);
                }
                if (ISPC) {
                    window.location.href = 'cyfs://static/info.html';
                } else {
                    window.location.href = 'cyfs://static/mobile/info.html';
                }
            }
        }
    }
}

if (!ISPC) {
    window.location.href = 'cyfs://static/activate.html';
} else {
    getIsSignIn();
}
