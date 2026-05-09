"use client";

function adminHeaders(): HeadersInit {
  const token = window.localStorage.getItem("kbAdminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchWithAdminToken(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<Response> {
  let res = await fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      ...adminHeaders(),
    },
  });

  if (res.status !== 401) return res;

  const token = window.prompt("Admin token required");
  if (!token) return res;

  window.localStorage.setItem("kbAdminToken", token);
  res = await fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  return res;
}
