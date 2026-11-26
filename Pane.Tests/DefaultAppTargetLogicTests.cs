using Pane;
using Xunit;

namespace Pane.Tests;

// 「画像を開く」で、文書に書かれたプログラムが動いていた(2026-11 の総点検2)。
// 既定のアプリへ渡すのは、http/https と画像の拡張子のファイルだけ。
public class DefaultAppTargetLogicTests
{
    [Theory]
    [InlineData(@"C:\docs\図.png")]
    [InlineData(@"C:\docs\photo.JPG")]
    [InlineData(@"\\server\share\a.svg")]
    [InlineData("/home/a/b.webp")]
    public void 画像のファイルは渡す(string path)
    {
        Assert.Equal(DefaultAppTargetLogic.Kind.ImageFile, DefaultAppTargetLogic.Classify(path));
    }

    [Theory]
    [InlineData("https://example.com/a")]
    [InlineData("http://example.com/x.exe")]
    public void WebのURLは渡す_ブラウザが開くため(string url)
    {
        Assert.Equal(DefaultAppTargetLogic.Kind.WebUrl, DefaultAppTargetLogic.Classify(url));
    }

    [Theory]
    [InlineData(@"C:\docs\setup.exe")]
    [InlineData(@"C:\docs\a.bat")]
    [InlineData(@"C:\docs\a.lnk")]
    [InlineData(@"C:\docs\a.js")]
    [InlineData(@"C:\docs\a.png.exe")]
    [InlineData(@"C:\docs\a.exe.")]
    [InlineData(@"C:\docs\a.exe ")]
    [InlineData(@"C:\docs\a.exe:b.png")]
    [InlineData("file:///C:/docs/a.png")]
    [InlineData("ms-settings:display")]
    [InlineData(@"C:\docs\noext")]
    [InlineData("")]
    [InlineData(null)]
    public void それ以外は渡さない(string? path)
    {
        Assert.Equal(DefaultAppTargetLogic.Kind.Refused, DefaultAppTargetLogic.Classify(path));
    }
}
