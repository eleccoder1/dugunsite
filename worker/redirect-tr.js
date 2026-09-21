export default {
  fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = "www.elifyusufcagri.com";
    url.port = "";
    return Response.redirect(url.toString(), request.method === "GET" || request.method === "HEAD" ? 301 : 308);
  }
};
