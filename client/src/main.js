import "./style.css";
import { init } from "echarts";
import { MosaicClient, coordinator } from "@uwdata/mosaic-core";
import { count, Query, desc } from "@uwdata/mosaic-sql";
import { tableFromArrays } from "@uwdata/flechette";

class ChartClient extends MosaicClient {
  constructor({ chart }) {
    super();
    this.chart = chart;
  }

  query() {
    return Query.select({
      name: "orderpriority",
      value: count("orderpriority"),
    })
      .from("sf1.orders")
      .groupby("orderpriority")
      .orderby(desc(count("orderpriority")));
  }

  queryResult(data) {
    chart.setOption({
      series: { type: "pie", radius: "50%", data: Array.from(data) },
    });

    return this;
  }
}

const chart = init(document.querySelector("#chart"));

async function* queryTrinoGenerator(query) {
  const initialResponse = await fetch("/v1/statement", {
    method: "POST",

    headers: {
      "X-Trino-User": "mosaic-client",
      "Content-Type": "text/plain",
      "X-Trino-Catalog": "tpch",
    },
    body: query,
  });

  const initialQueryResponse = await initialResponse.json();

  if (initialQueryResponse.data) {
    yield {
      data: initialQueryResponse.data,
      columns: initialQueryResponse.columns,
    };
  }

  let nextUri = initialQueryResponse.nextUri?.replace(
    "http://localhost:8080",
    ""
  );

  while (nextUri) {
    const nextResult = await fetch(nextUri);
    const nextResultData = await nextResult.json();

    if (nextResultData.data) {
      yield {
        data: nextResultData.data,
        columns: nextResultData.columns,
      };
    }

    nextUri = nextResultData.nextUri?.replace("http://localhost:8080", "");
  }
}

coordinator().manager._logQueries = true;
coordinator().databaseConnector({
  async query({ sql }) {
    const transpileResponse = await fetch("http://localhost:8000/transpile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: sql,
        source_dialect: "duckdb",
        target_dialect: "trino",
      }),
    });

    const { query: q } = await transpileResponse.json();

    const columnsArrays = {};

    for await (const { data, columns } of queryTrinoGenerator(q)) {
      if (!(columns[0] in columnsArrays)) {
        columns.forEach(({ name }) => (columnsArrays[name] = []));
      }

      data.forEach((row) => {
        columns.forEach(({ name }, index) => {
          columnsArrays[name].push(row[index]);
        });
      });
    }

    return tableFromArrays(columnsArrays);
  },
});

coordinator().connect(new ChartClient({ chart }));
