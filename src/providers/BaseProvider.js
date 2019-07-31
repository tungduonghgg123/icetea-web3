const { encodeTX, tryParseJson, tryJsonStringify } = require('../utils')

class BaseProvider {
  sanitizeParams (params) {
    params = params || {}
    Object.keys(params).forEach(k => {
      let v = params[k]
      if (typeof v === 'number') {
        params[k] = String(v)
      }
    })
    return params
  }

  _call (method, params) {
    throw new Error('BaseProvider._call is not implemented.')
  }

  // call a jsonrpc, normally to query blockchain (block, tx, validator, consensus, etc.) data
  call (method, params) {
    return this._call(method, params).then(resp => {
      if (resp.error) {
        const err = new Error(resp.error.data || resp.error.message)
        err.error = resp.error
        throw err
      }
      if (resp.id) resp.result.id = resp.id
      return resp.result
    })
  }

  // query application state (read)
  query (path, data, options) {
    const params = { path, ...options }
    if (data) {
      params.data = encodeTX(data, 'hex')
    }

    return this.call('abci_query', params).then(result => {
      const r = result.response
      const info = tryParseJson(r.info)

      if (r.code) {
        const err = new Error(tryJsonStringify((info && info.message) || info || data))
        err.code = r.code
        err.info = info
        throw err
      }

      return info
    })
  }

  // send a transaction (write)
  send (method, tx) {
    return this.call(method, {
      // for jsonrpc, encode in 'base64'
      // for query string (REST), encode in 'hex' (or 'utf8' inside quotes)
      tx: encodeTX(tx, 'base64')
    }).then(result => {
      const code = result.code || (result.check_tx && result.check_tx.code) || (result.deliver_tx && result.deliver_tx.code)
      if (code) {
        const log = result.log || (result.check_tx && result.check_tx.log) || (result.deliver_tx && result.deliver_tx.log)
        throw Object.assign(new Error(log), result)
      }

      return result
    })
  }
}

module.exports = BaseProvider
