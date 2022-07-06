const path = require('path')
const os = require('os')

function getCyfsDir() {
    if ( process.platform == 'win32' ) {
        return path.join(os.homedir(), 'AppData/Roaming/cyfs')
    } else if( process.platform == 'darwin') {
        return path.join(os.homedir(), 'Library/Application Support/cyfs')
    }else {
        throw  error('un know')
    }
}

module.exports = {
    getCyfsDir,
}

