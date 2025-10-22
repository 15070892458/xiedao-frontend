import { cookies } from "next/headers";
import { Configuration, DefaultApi } from "./api/index";

const apiConfig = new Configuration({
  basePath: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api",
  accessToken: async () => {
    const cookie = (await cookies()).get("access_token");
    return "Bearer " + (cookie?.value ?? "");
  },
});

export const api = new DefaultApi(apiConfig);
