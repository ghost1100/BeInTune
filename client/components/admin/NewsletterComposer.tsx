import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { searchImages } from "@/lib/unsplash";

export default function NewsletterComposer({
  onClose,
}: {
  onClose?: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Array<any>>([]);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files;
    if (!f) return;
    setFiles(Array.from(f));
  };

  const runSearch = async () => {
    if (!searchQuery) return;
    try {
      const r = await searchImages(searchQuery, 9);
      setResults(r);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Unable to search images" });
    }
  };

  const pickImage = (img: any) => {
    setSelectedImage(img);
  };

  const send = async () => {
    if (!subject || !html) {
      toast({
        title: "Missing fields",
        description: "Subject and content are required",
      });
      return;
    }
    setSending(true);
    try {
      const form = new FormData();
      form.append("subject", subject);
      form.append("html", html);
      if (selectedImage)
        form.append(
          "unsplash_image",
          selectedImage.full || selectedImage.thumb,
        );
      files.forEach((f, i) => form.append("attachments", f, f.name));
      const res = await fetch("/api/admin/newsletters", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Failed to send newsletter");
      toast({ title: "Sent", description: "Newsletter queued/sent" });
      setSubject("");
      setHtml("");
      setFiles([]);
      setSelectedImage(null);
      setResults([]);
      onClose?.();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Unable to send" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card rounded-md p-4 max-w-3xl w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Compose newsletter</h3>
        <div className="text-sm text-foreground/70">
          Use the editor to craft a magazine-style email
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="h-10 rounded-md border px-3"
        />

        {/* Unsplash search */}
        <div className="grid gap-2">
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for header image (Unsplash)"
              className="h-10 rounded-md border px-3 flex-1"
            />
            <Button onClick={runSearch} variant="outline">
              Search
            </Button>
          </div>

          {selectedImage ? (
            <div className="p-2 border rounded-md">
              <div className="mb-2 text-sm text-foreground/70">
                Selected image (Unsplash)
              </div>
              <img
                src={selectedImage.full || selectedImage.thumb}
                alt={selectedImage.alt || ""}
                className="w-full h-48 object-cover rounded"
              />
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" onClick={() => setSelectedImage(null)}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            results.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => pickImage(r)}
                    className="rounded overflow-hidden border"
                  >
                    <img
                      src={r.thumb}
                      alt={r.alt || ""}
                      className="w-full h-24 object-cover"
                    />
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="HTML content (you can paste HTML)"
          className="rounded-md border px-3 py-2 min-h-[160px]"
        />
        <input type="file" multiple onChange={onFiles} />
        <div className="flex items-center gap-2">
          <Button onClick={send} variant="gradient" size="lg">
            Send newsletter
          </Button>
          <Button
            onClick={() => {
              setSubject("");
              setHtml("");
              setFiles([]);
              setSelectedImage(null);
              setResults([]);
            }}
            variant="outline"
          >
            Clear
          </Button>
          <Button onClick={() => onClose?.()} variant="ghost">
            Close
          </Button>
        </div>
        {files.length > 0 && (
          <div className="mt-2 text-sm text-foreground/70">
            Attachments: {files.map((f) => f.name).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
