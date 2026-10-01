import { redirect } from "next/navigation";

export default async function ItemRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/item/${id}`);
}
