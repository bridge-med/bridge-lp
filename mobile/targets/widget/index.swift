import WidgetKit
import SwiftUI

// MARK: - Shared data (written by the app via App Group)

private let appGroup = "group.com.bridgemed.worklog"

struct QItem: Codable {
  let title: String
  let color: String
}

struct Quad: Codable {
  let key: String
  let label: String
  let count: Int
  let items: [QItem]
}

struct MatrixData: Codable {
  let updatedAt: Double
  let quadrants: [Quad]
}

func loadMatrix() -> MatrixData? {
  guard
    let defaults = UserDefaults(suiteName: appGroup),
    let str = defaults.string(forKey: "matrix"),
    let data = str.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(MatrixData.self, from: data)
}

// MARK: - Colors

extension Color {
  init?(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let v = UInt64(s, radix: 16) else { return nil }
    self.init(
      .sRGB,
      red: Double((v >> 16) & 0xff) / 255,
      green: Double((v >> 8) & 0xff) / 255,
      blue: Double(v & 0xff) / 255
    )
  }
}

private let cream = Color(hex: "FBF3E8") ?? .white
private let ink = Color(hex: "3B3026") ?? .black
private let sub = Color(hex: "6B5D4A") ?? .gray
private let line = Color(hex: "EADDC9") ?? .gray

// MARK: - Timeline

struct MatrixEntry: TimelineEntry {
  let date: Date
  let matrix: MatrixData?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> MatrixEntry { MatrixEntry(date: Date(), matrix: nil) }
  func getSnapshot(in context: Context, completion: @escaping (MatrixEntry) -> Void) {
    completion(MatrixEntry(date: Date(), matrix: loadMatrix()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<MatrixEntry>) -> Void) {
    let entry = MatrixEntry(date: Date(), matrix: loadMatrix())
    let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

// MARK: - Views

struct QuadCell: View {
  let quad: Quad?
  let maxItems: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 5) {
        Text(quad?.key ?? "")
          .font(.system(size: 12, weight: .heavy))
          .foregroundColor(.white)
          .frame(width: 20, height: 20)
          .background(ink)
          .clipShape(RoundedRectangle(cornerRadius: 6))
        Text(quad?.label ?? "")
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(ink)
          .lineLimit(1)
        Spacer(minLength: 0)
        Text("\(quad?.count ?? 0)")
          .font(.system(size: 14, weight: .heavy))
          .foregroundColor(ink)
      }
      ForEach(Array((quad?.items ?? []).prefix(maxItems).enumerated()), id: \.offset) { _, item in
        HStack(spacing: 4) {
          Circle()
            .fill(Color(hex: item.color) ?? line)
            .frame(width: 6, height: 6)
          Text(item.title)
            .font(.system(size: 10))
            .foregroundColor(sub)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(7)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Color.white.opacity(0.6))
    .overlay(RoundedRectangle(cornerRadius: 10).stroke(line, lineWidth: 1))
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }
}

struct MatrixWidgetView: View {
  var entry: MatrixEntry
  @Environment(\.widgetFamily) var family

  private func quad(_ key: String) -> Quad? {
    entry.matrix?.quadrants.first { $0.key == key }
  }
  private var maxItems: Int { family == .systemLarge ? 3 : 1 }

  var body: some View {
    VStack(spacing: 6) {
      HStack(spacing: 6) {
        QuadCell(quad: quad("A"), maxItems: maxItems)
        QuadCell(quad: quad("B"), maxItems: maxItems)
      }
      HStack(spacing: 6) {
        QuadCell(quad: quad("C"), maxItems: maxItems)
        QuadCell(quad: quad("D"), maxItems: maxItems)
      }
    }
    .padding(10)
    .widgetURL(URL(string: "bridgeworklog://"))
    .widgetContainerBackground(cream)
  }
}

extension View {
  @ViewBuilder
  func widgetContainerBackground(_ color: Color) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(color, for: .widget)
    } else {
      background(color)
    }
  }
}

// MARK: - Widget

@main
struct CareerLogWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CareerLogMatrix", provider: Provider()) { entry in
      MatrixWidgetView(entry: entry)
    }
    .configurationDisplayName("タスクマトリクス")
    .description("緊急×重要のA〜Dを一覧できます。")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
