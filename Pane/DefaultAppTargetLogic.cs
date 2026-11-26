namespace Pane;

/// <summary>
/// 「画像を開く」(右クリック)と取扱説明書の外部リンクで、OSの既定のアプリへ渡してよい相手かを決める。
///
/// 【何が起きていたか】(2026-11 の総点検2) 文書の中の画像の参照先を、種類も確かめずに
/// そのまま既定のアプリへ渡していた。人から受け取った文書に ![図](setup.exe) や
/// ![図](a.bat) と書かれていると、右クリックの「画像を開く」でそのプログラムが動いた
/// (Windowsは拡張子で起動の仕方を決めるため、.exe・.bat・.lnk・.js などはそのまま実行される)。
///
/// 渡すのは、http/https のURL と、画像の拡張子を持つファイルだけにする。
/// ファイルシステムに触れない判定だけをここへ置き、Pane.Tests で固定する(Windows専用のAPIを使わない)。
/// </summary>
internal static class DefaultAppTargetLogic
{
    internal enum Kind { Refused, WebUrl, ImageFile }

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".tif", ".tiff",
    };

    public static Kind Classify(string? target)
    {
        if (string.IsNullOrWhiteSpace(target)) return Kind.Refused;
        string t = target.Trim();

        if (Uri.TryCreate(t, UriKind.Absolute, out Uri? uri) && (uri.Scheme == "http" || uri.Scheme == "https"))
            return Kind.WebUrl;

        // ここから先はファイルのパスとして見る。URLの形(file: や独自の方式)は渡さない。
        if (t.Contains("://", StringComparison.Ordinal)) return Kind.Refused;
        // 「a.exe:b.png」のような代替データストリームや、方式名つきの文字列を除く(ドライブ名の「C:」だけ許す)。
        if (t.IndexOf(':', 2) >= 0) return Kind.Refused;
        if (t.Length >= 2 && t[1] != ':' && t.Contains(':')) return Kind.Refused;
        // Windowsは末尾の「.」と空白を捨てて開くため、「a.exe.」は .exe として動く。末尾がそれなら渡さない。
        if (t.EndsWith('.') || t.EndsWith(' ')) return Kind.Refused;

        int slash = Math.Max(t.LastIndexOf('/'), t.LastIndexOf('\\'));
        string name = t[(slash + 1)..];
        int dot = name.LastIndexOf('.');
        if (dot <= 0) return Kind.Refused;
        return ImageExtensions.Contains(name[dot..]) ? Kind.ImageFile : Kind.Refused;
    }
}
