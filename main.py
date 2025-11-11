from typing import Optional
import socket
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import httpx


app = FastAPI(title="Domain Checker API")


class DomainRequest(BaseModel):
	domain: str = Field(..., description="Domain name to check, e.g. example.com")


class HTTPCheck(BaseModel):
	ok: bool
	status_code: Optional[int] = None
	url: Optional[str] = None
	error: Optional[str] = None


class DomainCheckResponse(BaseModel):
	domain: str
	dns_resolves: bool
	ip: Optional[str] = None
	http: HTTPCheck
	https: HTTPCheck


@app.get("/health")
async def health():
	return {"status": "ok"}


@app.post("/check-domain", response_model=DomainCheckResponse)
async def check_domain(body: DomainRequest):
	"""Check DNS resolution and HTTP/HTTPS reachability for a domain.

	Returns DNS resolution result and attempts GET on http://domain and https://domain.
	"""

	domain = body.domain.strip()
	if not domain:
		raise HTTPException(status_code=422, detail="Empty domain")

	# DNS resolution
	ip = None
	dns_resolves = False
	try:
		ip = socket.gethostbyname(domain)
		dns_resolves = True
	except Exception:
		dns_resolves = False

	# HTTP checks
	timeout = httpx.Timeout(5.0, connect=3.0)
	http_check = HTTPCheck(ok=False)
	https_check = HTTPCheck(ok=False)

	async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
		# try http
		try:
			url = f"http://{domain}/"
			resp = await client.get(url)
			http_check.ok = 200 <= resp.status_code < 400
			http_check.status_code = resp.status_code
			http_check.url = url
		except Exception as e:
			http_check.ok = False   
			http_check.error = str(e)

		# try https
		try:
			url = f"https://{domain}/"
			resp = await client.get(url)
			https_check.ok = 200 <= resp.status_code < 400
			https_check.status_code = resp.status_code
			https_check.url = url
		except Exception as e:
			https_check.ok = False
			https_check.error = str(e)

	return DomainCheckResponse(
		domain=domain,
		dns_resolves=dns_resolves,
		ip=ip,
		http=http_check,
		https=https_check,
	)


if __name__ == "__main__":
	import uvicorn

	uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)