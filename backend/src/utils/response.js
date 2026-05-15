function sendError(res, status, message, details = undefined) {
  return res.status(status).json({
    ok: false,
    message,
    ...(details ? { details } : {}),
  });
}

function sendOk(res, payload = {}, status = 200) {
  return res.status(status).json({
    ok: true,
    ...payload,
  });
}

module.exports = {
  sendError,
  sendOk,
};
