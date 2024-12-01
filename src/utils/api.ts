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
