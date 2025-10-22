import { api } from "@/libs/api-server";
import { DocumentMetas } from "@/libs/api";
import { redirect } from "next/navigation";

export default async function DocumentsPage() {
  let res;
  try {
    res = await api.readUserDocumentListUsersMeDocumentsGet();
  } catch {
    redirect("/login");
  }

  return (
    <div>
      <ol>
        {res && res.items.map((value: DocumentMetas) => <li>value.title</li>)}
      </ol>
    </div>
  );
}
