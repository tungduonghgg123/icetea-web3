const { newAccount, getAccount } = require('icetea-common').utils
const { codec } = require('icetea-common')
const keythereum = require('keythereum')
const randomBytes = require('randombytes')

var _wallet = { defaultAccount: '', accounts: [] }
const _ram = {
  set wallet (value) {
    _wallet = value
  },
  get wallet () {
    return _wallet
  },
  set defaultAccount (value) {
    if (!_ram.wallet.accounts.length === 0) throw new Error('Please import account before set defaultAccount!')
    // check address in wallet
    var isExist = false
    for (var i = 0; i < _ram.wallet.accounts.length; i++) {
      if (_ram.wallet.accounts[i].address === value) {
        isExist = true
        break
      }
    }
    if (isExist) {
      _ram.wallet.defaultAccount = value
    } else {
      throw new Error('Address ' + value + " don't exist in wallet")
    }
  },
  get defaultAccount () {
    if (_ram.wallet.defaultAccount && _ram.wallet.defaultAccount !== '') {
      return _ram.wallet.defaultAccount
    } else if (_ram.wallet.accounts.length > 0) {
      // set defaultAccount is address of first account
      _ram.wallet.defaultAccount = _ram.wallet.accounts[0].address
      return _ram.wallet.defaultAccount
    }
  },
  addAccount (account) {
    // check private exsit before add account
    var isExist = false
    for (var i = 0; i < _ram.wallet.accounts.length; i++) {
      if (_ram.wallet.accounts[i].privateKey === account.privateKey) {
        isExist = true
        break
      }
    }
    if (!isExist) _ram.wallet.accounts.push(account)
  },
  getAccounts () {
    return _ram.wallet.accounts
  }
}

function getStorage () {
  if (typeof localStorage !== 'undefined') {
    return window.localStorage
  }

  const LocalStorage = require('node-localstorage').LocalStorage
  return new LocalStorage('./localStorage')
}

const _localStorage = getStorage()
const _storage = {
  saveData (data) {
    _localStorage.setItem('accounts', JSON.stringify(data))
  },
  getData () {
    var dataLocal = _localStorage.getItem('accounts')
    if (!dataLocal) dataLocal = `{"defaultAccount":"","accounts":[]}`
    return JSON.parse(dataLocal)
  },
  encode (password) {
    var options = {
      kdf: 'pbkdf2',
      cipher: 'aes-128-ctr',
      kdfparams: {
        c: 262144,
        dklen: 32,
        prf: 'hmac-sha256'
      }
    }

    var dk = _utils.createRandom()
    var walletStogare = { defaultAccount: '', accounts: [] }
    _ram.wallet.accounts.forEach(item => {
      var privateKey = codec.toBuffer(item.privateKey)
      var keyObject = keythereum.dump(password, privateKey, dk.salt, dk.iv, options)
      walletStogare.accounts.push(keyObject)
    })
    walletStogare.defaultAccount = _ram.wallet.defaultAccount
    return walletStogare
  },
  decode (password, walletStogare) {
    var wallettmp = { defaultAccount: '', accounts: [] }
    wallettmp.defaultAccount = walletStogare.defaultAccount
    walletStogare.accounts.forEach(keyObject => {
      var privateKey = keythereum.recover(password, keyObject)
      var account = getAccount(privateKey)
      wallettmp.accounts.push(account)
    })
    return wallettmp
  }
}

const _utils = {
  createRandom: function () {
    var keyBytes = 32
    var ivBytes = 16
    var random = randomBytes(keyBytes + ivBytes + keyBytes)
    return {
      iv: random.slice(keyBytes, keyBytes + ivBytes),
      salt: random.slice(keyBytes + ivBytes)
    }
  }
}

class Wallet {
  set defaultAccount (value) {
    _ram.defaultAccount = value
  }

  get defaultAccount () {
    return _ram.defaultAccount
  }

  get accounts () {
    return _ram.getAccounts()
  }

  createAccount () {
    var account = newAccount()
    _ram.addAccount(account)
    return account
  }

  importAccount (privateKey) {
    var account = getAccount(privateKey)
    _ram.addAccount(account)
    return account
  }

  getAccountByPrivateKey (privateKey) {
    return getAccount(privateKey)
  }

  getPrivateKeyByAddress (fromAddress) {
    if (!fromAddress) {
      fromAddress = this.defaultAccount
    }
    var account = this.getAccountByAddress(fromAddress)
    if (account) return account.privateKey
  }

  getAccountByAddress (address) {
    var accounts = this.accounts
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].address === address || accounts[i].publicKey === address) {
        return accounts[i]
      }
    }
  }

  saveToStorage (password) {
    if (!password) password = window.prompt('Please enter your password')
    var walletStogare = _storage.encode(password)
    _storage.saveData(walletStogare)
    return walletStogare.accounts.length
  }

  loadFromStorage (password) {
    var walletStogare = _storage.getData()
    if (walletStogare && walletStogare.accounts.length > 0) {
      if (!password) password = window.prompt('Please enter your password')
      var wallettmp = _storage.decode(password, walletStogare)
      // load data from localstorage and set on wallet in ram
      _ram.wallet = wallettmp
      console.log('Load wallet from storage', _ram.wallet)
    }
    return _ram.wallet.accounts.length
  }
}

module.exports = Wallet
