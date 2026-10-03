import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { API_URL, request } from "./api";
import { useSession } from "./session";

export async function uploadDocument(title: string, category: string, ownersOnly: boolean) {
  const result = await DocumentPicker.getDocumentAsync({type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], copyToCacheDirectory:true});
  if (result.canceled) return;
  const asset = result.assets[0];
  const data = new FormData();
  data.append("file", {uri:asset.uri,name:asset.name,type:asset.mimeType ?? "application/pdf"} as unknown as Blob);
  await request(`/admin/resources/documents?title=${encodeURIComponent(title)}&category=${encodeURIComponent(category)}&owners_only=${ownersOnly}`, {method:"POST",body:data});
}

export async function shareFile(path: string, filename: string) {
  // Refresh the session before downloading with native authenticated networking.
  await request("/residents/me");
  const session = useSession.getState();
  const destination = new File(Paths.cache, filename);
  const file = await File.downloadFileAsync(`${API_URL}${path}`, destination, {
    idempotent: true,
    headers: {
      Authorization: `Bearer ${session.tokens?.access_token}`,
      "X-Property-Id": session.property?.id ?? "",
    },
  });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: filename.endsWith(".zip") ? "application/zip" : filename.endsWith(".csv") ? "text/csv" : filename.endsWith(".json") ? "application/json" : "application/pdf",
      UTI: filename.endsWith(".pdf") ? "com.adobe.pdf" : "public.text",
      dialogTitle: "Save or share document",
    });
  else throw new Error("Sharing is unavailable on this device.");
}

export async function pickImage(): Promise<{ id: string; uri: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("Allow photo access to choose an attachment.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const data = new FormData();
  data.append("file", {
    uri: asset.uri,
    name: asset.fileName ?? "photo.jpg",
    type: asset.mimeType ?? "image/jpeg",
  } as unknown as Blob);
  const upload = await request<{ id: string }>("/uploads", {
    method: "POST",
    body: data,
  });
  return { id: upload.id, uri: asset.uri };
}
