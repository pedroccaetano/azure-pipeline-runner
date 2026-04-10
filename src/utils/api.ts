import axios, { AxiosInstance } from "axios";

export function getAxiosInstance(pat: string): AxiosInstance {
  const encodedPat = Buffer.from(`:${pat}`).toString("base64");
  return axios.create({
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${encodedPat}`,
    },
  });
}

export function getBearerAxiosInstance(token: string): AxiosInstance {
  return axios.create({
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      // Without this header, Azure DevOps returns 203 + HTML sign-in page
      // instead of 401 when the token is invalid/not accepted.
      "X-TFS-FedAuthRedirect": "Suppress",
    },
  });
}
